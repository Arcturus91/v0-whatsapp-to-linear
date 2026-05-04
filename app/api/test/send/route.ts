import { getBot } from '@/lib/chat/bot'
import { getEnv } from '@/lib/env'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Synthetic Kapso webhook for QA. Constructs a Meta-shaped payload,
 * signs it with the webhook secret, and feeds it through the same
 * route the real Kapso traffic hits. This exercises the adapter,
 * dedupe, locking, and handler — i.e. the full stack.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    from?: string
    text?: string
  }
  const env = getEnv()
  const from = body.from ?? '+14155551234'
  const text = body.text ?? 'hola, ping de prueba'

  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'test-business',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: from,
                phone_number_id: env.KAPSO_PHONE_NUMBER_ID,
              },
              contacts: [
                {
                  profile: { name: 'QA Tester' },
                  wa_id: from.replace(/^\+/, ''),
                },
              ],
              messages: [
                {
                  from: from.replace(/^\+/, ''),
                  id: `wamid.test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  }

  const raw = JSON.stringify(payload)
  const sig = crypto
    .createHmac('sha256', env.KAPSO_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex')

  const fakeReq = new Request('http://localhost/api/whatsapp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${sig}`,
    },
    body: raw,
  })

  const res = await getBot().webhooks.whatsapp(fakeReq)
  return new Response(
    JSON.stringify({ ok: res.ok, status: res.status }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}
