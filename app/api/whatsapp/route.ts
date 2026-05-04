import { createHmac, timingSafeEqual } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { getBot } from '@/lib/chat/bot'
import { getEnv } from '@/lib/env'
import {
  isInboundMessageEvent,
  isKapsoV2Request,
  translateKapsoToMeta,
} from '@/lib/kapso/v2-to-meta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Kapso webhook entry point.
 *
 * Sandbox configs only support Kapso v2 payload format. We:
 *   1) verify Kapso's HMAC-SHA256 signature against the raw body
 *   2) ignore non-message events (delivery reports, conversation lifecycle, etc.)
 *   3) translate the v2 body to Meta WhatsApp Cloud API shape
 *   4) re-sign with KAPSO_WEBHOOK_SECRET and forward to @chat-adapter/whatsapp
 *
 * If the request is already Meta-shaped (e.g. someone toggles Meta-forward
 * mode in the future), we pass it straight to the adapter.
 */
export async function POST(req: Request): Promise<Response> {
  const env = getEnv()
  const rawBody = await req.text()

  if (isKapsoV2Request(req)) {
    const event = req.headers.get('x-webhook-event')
    const sig = req.headers.get('x-webhook-signature')
    if (!verifyKapsoSignature(rawBody, sig, env.KAPSO_WEBHOOK_SECRET)) {
      console.warn('[/api/whatsapp] kapso v2 signature mismatch')
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (!isInboundMessageEvent(event)) {
      console.log('[/api/whatsapp] non-inbound event ignored:', event)
      return new Response(null, { status: 204 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return new Response(JSON.stringify({ error: 'invalid JSON' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const items = unwrapBatch(parsed)
    if (items.length === 0) {
      console.log(
        '[/api/whatsapp] batched envelope had no extractable items; keys=',
        parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : typeof parsed,
      )
      return new Response(null, { status: 204 })
    }

    let lastResp: Response | null = null
    for (const item of items) {
      try {
        const metaBody = translateKapsoToMeta(
          item as Parameters<typeof translateKapsoToMeta>[0],
        )
        lastResp = await forwardToAdapter(metaBody, req, env.KAPSO_WEBHOOK_SECRET)
      } catch (err) {
        console.error('[/api/whatsapp] batch item failed:', err)
      }
    }
    return lastResp ?? new Response(null, { status: 204 })
  }

  // Meta-forward (or unknown). Try to pass through unchanged.
  try {
    const synthetic = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: rawBody,
    })
    return await getBot().webhooks.whatsapp(synthetic, { waitUntil })
  } catch (err) {
    console.error('[/api/whatsapp] handler failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

/**
 * Webhook verification challenge from Meta-style providers.
 * Sandbox Kapso v2 doesn't use this; kept for forward-compat with
 * Meta-forward mode.
 */
export async function GET(req: Request): Promise<Response> {
  return getBot().webhooks.whatsapp(req)
}

async function forwardToAdapter(
  metaBody: unknown,
  originalReq: Request,
  secret: string,
): Promise<Response> {
  const body = JSON.stringify(metaBody)
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  const headers = new Headers(originalReq.headers)
  headers.set('content-type', 'application/json')
  headers.set('x-hub-signature-256', sig)
  headers.delete('x-webhook-signature')
  headers.delete('x-webhook-event')
  headers.delete('x-webhook-payload-version')
  headers.delete('content-length')

  const synthetic = new Request(originalReq.url, {
    method: 'POST',
    headers,
    body,
  })
  try {
    return await getBot().webhooks.whatsapp(synthetic, { waitUntil })
  } catch (err) {
    console.error('[/api/whatsapp] adapter failed on translated payload:', err)
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

/**
 * Kapso buffers events and may wrap them when X-Webhook-Batch=true.
 * The exact envelope isn't documented, so we accept three shapes:
 *   1) the body itself is an array of single-event payloads
 *   2) { events: [...] }
 *   3) a single-event object (treated as a list of one)
 */
function unwrapBatch(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.events)) return obj.events
    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.items)) return obj.items
    if ('message' in obj && 'conversation' in obj) return [obj]
  }
  return []
}

function verifyKapsoSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const received = signatureHeader.replace(/^sha256=/, '').trim()
  if (received.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
