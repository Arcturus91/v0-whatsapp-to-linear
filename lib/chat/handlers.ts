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

const ISSUE_ID_RE = /\b[A-Z]{2,5}-\d+\b/g
const TTS_REPLY_MAX_CHARS = 600

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

    const audioAttachment = pickAudioAttachment(message.attachments)
    if (audioAttachment) {
      modality = 'audio'
      try {
        const { buffer, mimeType } = await fetchAttachment(audioAttachment)
        userText = (await transcribe(buffer, mimeType)).trim()
        await emitVoiceTranscribed({
          id: newId('voice'),
          conversationId,
          userId: fromUser,
          type: 'voice_note',
          content: userText,
          timestamp: Date.now(),
        })
      } catch (err) {
        console.error('[handlers] STT failed:', err)
      }
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
      const agent = await buildAgent()
      const result = await agent.stream({
        prompt: userText,
        onStepFinish: async (step) => {
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

      await thread.post(result.fullStream)
      finalText = await result.text

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
      console.error('[handlers] agent failed:', err)
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
