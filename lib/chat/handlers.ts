import { Buffer } from 'node:buffer'
import type { Chat, Thread, Message, Attachment } from 'chat'
import {
  emitBotResponse,
  emitVoiceTranscribed,
  emitWhatsAppMessage,
  trackIssue,
} from '@/lib/events/emit'
import { buildAgent } from '@/lib/agent/agent'
import { getEnv } from '@/lib/env'
import { transcribe } from '@/lib/voice/stt'
import { synthesize } from '@/lib/voice/tts'
import { uploadMedia } from '@/lib/kapso/media'
import { markReadWithTyping } from '@/lib/kapso/typing'
import { checkRateLimit } from '@/lib/safety/rate-limit'

const ISSUE_ID_RE = /\b[A-Z]{2,5}-\d+\b/g
const TTS_REPLY_MAX_CHARS = 600
// Rough proxy for ~60s of WhatsApp opus voice notes. attachment.metadata
// .duration isn't reliably populated by the adapter so we use buffer size.
const AUDIO_MAX_BYTES = 200 * 1024

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Wire the Chat SDK bot to the LinearVoice agent.
 * - Transcribes inbound voice notes via ElevenLabs.
 * - Streams the agent reply into thread.post().
 * - For voice-in conversations, also synthesizes a TTS reply and posts
 *   it as a Kapso/WhatsApp audio attachment. TTS failures never block
 *   the text reply.
 * - Emits dashboard events for every step (PM contract: linearvoice:events:*).
 */
export function registerHandlers(bot: Chat): void {
  const env = getEnv()

  bot.onDirectMessage(async (thread: Thread, message: Message) => {
    const conversationId = thread.id
    const ts = Date.now()
    const fromUser = message.author?.userId ?? 'unknown'
    let userText = (message.text ?? '').trim()
    let modality: 'text' | 'audio' = 'text'

    // Abuse guard: per-phone rate limit before any expensive work.
    const limit = await checkRateLimit(fromUser)
    if (!limit.allowed) {
      const reply =
        limit.reason === 'day'
          ? 'Llegaste al máximo de mensajes por hoy. Volvé mañana ✌️'
          : 'Estás mandando muchos mensajes muy rápido. Esperá un minuto y reintentá.'
      await thread.post(reply).catch(() => {})
      await emitWhatsAppMessage({
        id: message.id ?? newId('msg'),
        from: fromUser,
        to: env.KAPSO_PHONE_NUMBER_ID,
        text: userText,
        timestamp: ts,
        metadata: {
          rateLimited: true,
          reason: limit.reason,
          retryAfterSeconds: limit.retryAfterSeconds,
        },
      })
      await emitBotResponse({
        id: newId('bot'),
        conversationId,
        userId: fromUser,
        type: 'message',
        content: reply,
        metadata: { rateLimited: true, reason: limit.reason },
        timestamp: Date.now(),
      })
      return
    }

    // Fire-and-forget: shows the "typing..." animation during STT + agent
    // run. Don't await — saves a few hundred ms on the critical path.
    if (message.id) void markReadWithTyping(message.id)

    const audioAttachment = pickAudioAttachment(message.attachments)
    let audioTooLong = false
    if (audioAttachment) {
      modality = 'audio'
      try {
        const { buffer, mimeType } = await fetchAttachment(audioAttachment)
        if (buffer.byteLength > AUDIO_MAX_BYTES) {
          audioTooLong = true
          console.warn('[handlers] audio too long, skipping STT:', {
            bytes: buffer.byteLength,
            max: AUDIO_MAX_BYTES,
          })
        } else {
          userText = (await transcribe(buffer, mimeType)).trim()
          await emitVoiceTranscribed({
            id: newId('voice'),
            conversationId,
            userId: fromUser,
            type: 'voice_note',
            content: userText,
            timestamp: Date.now(),
          })
        }
      } catch (err) {
        console.error('[handlers] STT failed:', err)
      }
    }

    if (audioTooLong) {
      const reply =
        'El audio es muy largo. Mandame algo más corto (máximo 1 minuto) o escribime directo.'
      await emitWhatsAppMessage({
        id: message.id ?? newId('msg'),
        from: fromUser,
        to: env.KAPSO_PHONE_NUMBER_ID,
        text: '',
        mediaType: 'audio',
        timestamp: ts,
        metadata: { audioTooLong: true },
      })
      await thread.post(reply).catch(() => {})
      await emitBotResponse({
        id: newId('bot'),
        conversationId,
        userId: fromUser,
        type: 'message',
        content: reply,
        metadata: { audioTooLong: true },
        timestamp: Date.now(),
      })
      return
    }

    await emitWhatsAppMessage({
      id: message.id ?? newId('msg'),
      from: fromUser,
      to: env.KAPSO_PHONE_NUMBER_ID,
      text: userText,
      mediaType: modality === 'audio' ? 'audio' : undefined,
      timestamp: ts,
    })

    if (!userText) {
      const reply =
        modality === 'audio'
          ? 'No pude entender el audio — ¿podrías repetirlo o mandarme texto?'
          : '¿Podrías mandarme un mensaje de texto o nota de voz?'
      await thread.post(reply)
      await emitBotResponse({
        id: newId('bot'),
        conversationId,
        userId: fromUser,
        type: 'message',
        content: reply,
        timestamp: Date.now(),
      })
      return
    }

    if (!env.LINEAR_OAUTH_TOKEN) {
      const reply = `Recibí: "${userText}". (Linear MCP no configurado todavía: define LINEAR_OAUTH_TOKEN para activar el agente.)`
      await thread.post(reply)
      await emitBotResponse({
        id: newId('bot'),
        conversationId,
        userId: fromUser,
        type: 'message',
        content: reply,
        timestamp: Date.now(),
      })
      return
    }

    let finalText = ''
    try {
      console.log('[handlers] AUTH presence:', {
        oidc: !!process.env.VERCEL_OIDC_TOKEN,
        gatewayKey: !!process.env.AI_GATEWAY_API_KEY,
        linear: !!env.LINEAR_OAUTH_TOKEN,
      })
      console.log('[handlers] buildAgent: start')
      const agent = await buildAgent()
      console.log('[handlers] buildAgent: ok')

      const messages = await buildAgentMessages(thread, message.id, userText)
      console.log('[handlers] agent.stream: start', {
        currentLen: userText.length,
        historyTurns: messages.length - 1,
      })
      const result = await agent.stream({
        messages,
        onStepFinish: async (step) => {
          console.log('[handlers] agent.stream: step', {
            toolCalls: step.toolCalls?.length ?? 0,
            toolResults: step.toolResults?.length ?? 0,
          })
          for (const call of step.toolCalls ?? []) {
            console.log('[agent] tool_call_started', {
              conversationId,
              toolCallId: call.toolCallId,
              tool: call.toolName,
            })
          }
          for (const r of step.toolResults ?? []) {
            console.log('[agent] tool_call_finished', {
              conversationId,
              toolCallId: r.toolCallId,
            })
          }
        },
      })
      console.log('[handlers] agent.stream: returned, posting to thread')

      await thread.post(result.fullStream)
      console.log('[handlers] thread.post: ok, awaiting result.text')
      finalText = await result.text
      console.log('[handlers] result.text: resolved', { len: finalText.length })

      for (const id of finalText.match(ISSUE_ID_RE) ?? []) {
        await trackIssue(id).catch(() => {})
      }

      await emitBotResponse({
        id: newId('bot'),
        conversationId,
        userId: fromUser,
        type: 'message',
        content: finalText,
        timestamp: Date.now(),
      })
    } catch (err) {
      console.error('[handlers] agent failed (caught):', err)
      const friendly =
        'Algo no anda con el agente justo ahora. ¿Podrías reintentar en un minuto?'
      await thread.post(friendly).catch(() => {})
      await emitBotResponse({
        id: newId('bot'),
        conversationId,
        userId: fromUser,
        type: 'message',
        content: friendly,
        metadata: { error: err instanceof Error ? err.message : String(err) },
        timestamp: Date.now(),
      })
      return
    }

    // Voice reply (best-effort): only when the user spoke and the reply
    // is short. Failures here must not affect the already-posted text.
    if (
      modality === 'audio' &&
      finalText &&
      finalText.length <= TTS_REPLY_MAX_CHARS &&
      env.ELEVENLABS_API_KEY
    ) {
      try {
        const audio = await synthesize(finalText)
        const mediaId = await uploadMedia(audio, 'audio/mpeg')
        await thread.post({
          raw: '',
          attachments: [
            {
              type: 'audio',
              mimeType: 'audio/mpeg',
              data: audio,
              fetchMetadata: { mediaId },
            },
          ],
        })
        await emitBotResponse({
          id: newId('bot'),
          conversationId,
          userId: fromUser,
          type: 'message',
          content: '[audio]',
          metadata: { modality: 'audio', mediaId },
          timestamp: Date.now(),
        })
      } catch (err) {
        console.error('[handlers] TTS failed:', err)
      }
    }
  })
}

/**
 * Pull prior thread messages and append the current user turn so the
 * ToolLoopAgent has multi-turn context (otherwise it forgets what was
 * said and demands the user re-state every detail).
 *
 * Audio turns are surfaced via STT into emitVoiceTranscribed but the
 * raw WhatsApp Message has empty `.text`, so historic audio shows up
 * as blank entries and we drop them. Trade-off accepted for hackathon.
 */
const MAX_HISTORY_TURNS = 20
async function buildAgentMessages(
  thread: Thread,
  currentMessageId: string,
  currentUserText: string,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  try {
    for await (const m of thread.allMessages) {
      if (m.id === currentMessageId) continue
      const text = (m.text ?? '').trim()
      if (!text) continue
      history.push({
        role: m.author?.isMe ? 'assistant' : 'user',
        content: text,
      })
    }
  } catch (err) {
    console.warn('[handlers] failed to load thread history:', err)
  }
  const trimmed = history.slice(-MAX_HISTORY_TURNS)
  return [...trimmed, { role: 'user', content: currentUserText }]
}

function pickAudioAttachment(attachments: Attachment[] | undefined): Attachment | undefined {
  return attachments?.find((a) => a.type === 'audio')
}

async function fetchAttachment(att: Attachment): Promise<{ buffer: Buffer; mimeType: string }> {
  if (att.data) {
    const buf = att.data instanceof Buffer ? att.data : Buffer.from(await (att.data as Blob).arrayBuffer())
    return { buffer: buf, mimeType: att.mimeType ?? 'audio/ogg' }
  }
  if (att.fetchData) {
    const buf = await att.fetchData()
    return { buffer: buf, mimeType: att.mimeType ?? 'audio/ogg' }
  }
  throw new Error('attachment has no data or fetcher')
}
