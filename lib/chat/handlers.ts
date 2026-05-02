import { Buffer } from 'node:buffer'
import type { Chat, Thread, Message, Attachment } from 'chat'
import { emit, trackIssue } from '@/lib/events/emit'
import { buildAgent } from '@/lib/agent/agent'
import { getEnv } from '@/lib/env'
import { transcribe } from '@/lib/voice/stt'
import { synthesize } from '@/lib/voice/tts'
import { uploadMedia } from '@/lib/kapso/media'

const ISSUE_ID_RE = /\b[A-Z]{2,5}-\d+\b/g
const TTS_REPLY_MAX_CHARS = 600

/**
 * Wire the Chat SDK bot to the LinearVoice agent.
 * - Transcribes inbound voice notes via ElevenLabs.
 * - Streams the agent reply into thread.post().
 * - For voice-in conversations, also synthesizes a TTS reply and posts
 *   it as a Kapso/WhatsApp audio attachment. TTS failures never block
 *   the text reply.
 * - Emits dashboard events for every step.
 */
export function registerHandlers(bot: Chat): void {
  bot.onDirectMessage(async (thread: Thread, message: Message) => {
    const conversationId = thread.id
    const ts = Date.now()
    let userText = (message.text ?? '').trim()
    let modality: 'text' | 'audio' = 'text'

    const audioAttachment = pickAudioAttachment(message.attachments)
    if (audioAttachment) {
      modality = 'audio'
      try {
        const { buffer, mimeType } = await fetchAttachment(audioAttachment)
        userText = (await transcribe(buffer, mimeType)).trim()
      } catch (err) {
        await emit({
          type: 'error',
          conversationId,
          error: `STT failed: ${err instanceof Error ? err.message : String(err)}`,
          ts: Date.now(),
        })
      }
    }

    await emit({
      type: 'message_received',
      conversationId,
      from: message.author?.userId ?? 'unknown',
      content: userText,
      modality,
      ts,
    })

    if (!userText) {
      const reply =
        modality === 'audio'
          ? 'No pude entender el audio — ¿podrías repetirlo o mandarme texto?'
          : '¿Podrías mandarme un mensaje de texto o nota de voz?'
      await thread.post(reply)
      await emit({
        type: 'message_sent',
        conversationId,
        content: reply,
        modality: 'text',
        ts: Date.now(),
      })
      return
    }

    const env = getEnv()
    if (!env.LINEAR_OAUTH_TOKEN) {
      const reply = `Recibí: "${userText}". (Linear MCP no configurado todavía: define LINEAR_OAUTH_TOKEN para activar el agente.)`
      await thread.post(reply)
      await emit({
        type: 'message_sent',
        conversationId,
        content: reply,
        modality: 'text',
        ts: Date.now(),
      })
      return
    }

    const toolStartedAt = new Map<string, number>()
    let finalText = ''
    try {
      const agent = await buildAgent()
      const result = await agent.stream({
        prompt: userText,
        onStepFinish: async (step) => {
          for (const call of step.toolCalls ?? []) {
            toolStartedAt.set(call.toolCallId, Date.now())
            await emit({
              type: 'tool_call_started',
              conversationId,
              toolCallId: call.toolCallId,
              tool: call.toolName,
              input: (call as { input?: unknown }).input,
              ts: Date.now(),
            })
          }
          for (const r of step.toolResults ?? []) {
            const startedAt = toolStartedAt.get(r.toolCallId) ?? Date.now()
            const latencyMs = Math.max(0, Date.now() - startedAt)
            await emit({
              type: 'tool_call_finished',
              conversationId,
              toolCallId: r.toolCallId,
              output: (r as { output?: unknown }).output,
              latencyMs,
              ts: Date.now(),
            })
          }
        },
      })

      await thread.post(result.fullStream)
      finalText = await result.text

      for (const id of finalText.match(ISSUE_ID_RE) ?? []) {
        await trackIssue(id).catch(() => {})
      }

      await emit({
        type: 'message_sent',
        conversationId,
        content: finalText,
        modality: 'text',
        ts: Date.now(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await emit({
        type: 'error',
        conversationId,
        error: message,
        ts: Date.now(),
      })
      const friendly = 'Algo no anda con el agente justo ahora. ¿Podrías reintentar en un minuto?'
      await thread.post(friendly).catch(() => {})
      await emit({
        type: 'message_sent',
        conversationId,
        content: friendly,
        modality: 'text',
        ts: Date.now(),
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
        await emit({
          type: 'message_sent',
          conversationId,
          content: '[audio]',
          modality: 'audio',
          ts: Date.now(),
        })
      } catch (err) {
        await emit({
          type: 'error',
          conversationId,
          error: `TTS failed: ${err instanceof Error ? err.message : String(err)}`,
          ts: Date.now(),
        })
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
