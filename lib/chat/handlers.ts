import type { Chat, Thread, Message } from 'chat'
import { emit } from '@/lib/events/emit'

/**
 * Wire up Chat SDK handlers on the bot. Step 2 implementation echoes
 * the user back so we can verify the webhook → adapter → state pipe
 * end-to-end. Step 3 swaps the body for a ToolLoopAgent + Linear MCP.
 */
export function registerHandlers(bot: Chat): void {
  bot.onDirectMessage(async (thread: Thread, message: Message) => {
    const ts = Date.now()
    const conversationId = thread.id
    const text = message.text ?? ''
    await emit({
      type: 'message_received',
      conversationId,
      from: message.author?.userId ?? 'unknown',
      content: text,
      modality: 'text',
      ts,
    })

    const reply = `echo: ${text}`
    await thread.post(reply)

    await emit({
      type: 'message_sent',
      conversationId,
      content: reply,
      modality: 'text',
      ts: Date.now(),
    })
  })
}
