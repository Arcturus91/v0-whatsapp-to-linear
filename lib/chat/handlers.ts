import type { Chat, Thread, Message } from 'chat'
import { emit, trackIssue } from '@/lib/events/emit'
import { buildAgent } from '@/lib/agent/agent'
import { getEnv } from '@/lib/env'

const ISSUE_ID_RE = /\b[A-Z]{2,5}-\d+\b/g

/**
 * Wire the Chat SDK bot to the LinearVoice agent.
 * - Emits dashboard events for every message and tool call.
 * - Streams the agent reply directly into thread.post() so the user
 *   sees it incrementally on platforms that support live updates.
 * - Falls back to a friendly error message when the agent throws.
 */
export function registerHandlers(bot: Chat): void {
  bot.onDirectMessage(async (thread: Thread, message: Message) => {
    const conversationId = thread.id
    const ts = Date.now()
    const userText = (message.text ?? '').trim()
    const modality: 'text' | 'audio' = 'text' // step 5 sets this to 'audio' for voice notes

    await emit({
      type: 'message_received',
      conversationId,
      from: message.author?.userId ?? 'unknown',
      content: userText,
      modality,
      ts,
    })

    if (!userText) {
      const reply = '¿Podrías mandarme un mensaje de texto o nota de voz? No detecté contenido legible.'
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
      // Useful while LINEAR_OAUTH_TOKEN is missing — keeps the wire
      // testable from /api/test/send before the team configures Linear.
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

      // Pass the AI SDK fullStream to Chat SDK; it filters text deltas
      // and emits one or more platform messages with progressive
      // updates where supported.
      await thread.post(result.fullStream)
      const finalText = await result.text

      // Track any Linear identifiers we mentioned for the dashboard.
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
    }
  })
}
