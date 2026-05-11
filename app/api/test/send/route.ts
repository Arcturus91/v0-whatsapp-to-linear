import { getBot } from '@/lib/chat/bot'
import { getEnv } from '@/lib/env'
import { checkIpRateLimit } from '@/lib/safety/rate-limit'
import {
  extractClientIp,
  gateProdAuth,
} from '@/lib/safety/test-endpoint-auth'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Synthetic Kapso webhook for QA. Constructs a Meta-shaped payload,
 * signs it with KAPSO_WEBHOOK_SECRET, and dispatches through the same
 * route real Kapso traffic hits — i.e. it exercises the full bot stack
 * (adapter, dedupe, lock, handler, agent, paid APIs).
 *
 * Auth model:
 *   - Production: if TEST_ENDPOINT_SECRET is unset, the endpoint 404s
 *     (deny by default — don't reveal it exists). If set, requests
 *     must present `Authorization: Bearer ${TEST_ENDPOINT_SECRET}`,
 *     compared in constant time. The gate logic lives in
 *     lib/safety/test-endpoint-auth.ts (pure function so the smoke can
 *     unit-test it).
 *   - Development: open, but rate-limited at 5 req/min per client IP.
 *     The IP limiter fails CLOSED on Redis errors — dev is the only
 *     place where there's no bearer covering us, and tunnels expose
 *     dev to the public internet.
 *
 * Probe mode: `?probe=1` short-circuits AFTER the gate (so it still
 * counts against the rate limit) but BEFORE the bot dispatch. Used by
 * scripts/smoke-test-endpoint-auth.mjs to exercise the auth + rate-
 * limit branches without burning AI Gateway / ElevenLabs / Linear
 * quota. Also useful as a no-cost reachability probe in prod once you
 * have a valid bearer.
 */
export async function POST(req: Request): Promise<Response> {
  const env = getEnv()
  const isProd = env.NODE_ENV === 'production'

  if (isProd) {
    const gate = gateProdAuth({
      authHeader: req.headers.get('authorization'),
      secret: env.TEST_ENDPOINT_SECRET,
    })
    if (gate.kind === 'deny') {
      return gate.status === 404
        ? new Response(null, { status: 404 })
        : jsonResponse({ error: 'unauthorized' }, 401)
    }
  } else {
    const ip = extractClientIp(req.headers.get('x-forwarded-for'))
    const limit = await checkIpRateLimit(ip)
    if (!limit.allowed) {
      return jsonResponse(
        {
          error:
            limit.reason === 'redis_unavailable'
              ? 'rate_limiter_unavailable'
              : 'rate_limited',
          retryAfter: limit.retryAfterSeconds,
        },
        429,
      )
    }
  }

  if (new URL(req.url).searchParams.get('probe') === '1') {
    return jsonResponse({ ok: true, probe: true }, 200)
  }

  const body = (await req.json().catch(() => ({}))) as {
    from?: string
    text?: string
  }
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
                  id: `wamid.test-${Date.now()}-${crypto.randomUUID()}`,
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
  return jsonResponse({ ok: res.ok, status: res.status }, 200)
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
