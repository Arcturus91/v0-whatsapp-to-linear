import { getBot } from '@/lib/chat/bot'
import { emit } from '@/lib/events/emit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Kapso webhook entry point. Kapso emulates the Meta WhatsApp Cloud
 * API, so the Chat SDK adapter handles the payload natively.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    return await getBot().webhooks.whatsapp(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await emit({ type: 'error', error: message, ts: Date.now() }).catch(() => {})
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

/**
 * Webhook verification challenge from Meta/Kapso.
 * The adapter would normally handle this, but Next routes need an
 * explicit GET handler — delegate to the adapter via the Chat SDK.
 */
export async function GET(req: Request): Promise<Response> {
  return getBot().webhooks.whatsapp(req)
}
