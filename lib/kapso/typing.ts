/**
 * Mark an inbound WhatsApp message as read AND show the typing indicator
 * to the user. Indicator dismisses when we send the reply or after ~25s.
 *
 * The chat-adapter's `startTyping()` is a no-op for WhatsApp, so we hit
 * Kapso's Meta proxy directly. Best-effort: failures must not block the
 * agent run.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/mark-messages-as-read
 */
import { getEnv } from '@/lib/env'

export async function markReadWithTyping(messageId: string): Promise<void> {
  const env = getEnv()
  const url = `${env.KAPSO_GRAPH_API_URL.replace(/\/$/, '')}/meta/whatsapp/v24.0/${env.KAPSO_PHONE_NUMBER_ID}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': env.KAPSO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' },
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[typing] mark+typing failed', { status: res.status, body: body.slice(0, 200) })
    }
  } catch (err) {
    console.warn('[typing] mark+typing threw:', err)
  }
}
