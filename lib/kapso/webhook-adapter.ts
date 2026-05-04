/**
 * Kapso ↔ Chat SDK WhatsApp adapter glue.
 *
 * Kapso's Meta-emulating API lives at `${KAPSO_API_BASE}/meta/whatsapp/v24.0`
 * and authenticates via `X-API-Key`, NOT `Authorization: Bearer`. The
 * chat-adapter hard-codes Bearer auth, so we monkey-patch globalThis.fetch
 * once at module load to translate Bearer → X-API-Key for any call to the
 * Kapso host. This is hacky but isolated; remove if/when chat-adapter adds
 * a header-override config.
 */
import { createWhatsAppAdapter } from '@chat-adapter/whatsapp'
import { getEnv } from '@/lib/env'

let adapter: ReturnType<typeof createWhatsAppAdapter> | null = null
let fetchPatched = false

function patchFetchForKapso(): void {
  if (fetchPatched) return
  fetchPatched = true
  const original = globalThis.fetch
  const env = getEnv()
  let kapsoHost: string
  try {
    kapsoHost = new URL(env.KAPSO_GRAPH_API_URL).host
  } catch {
    kapsoHost = 'api.kapso.ai'
  }
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    let host = ''
    try {
      host = new URL(url).host
    } catch {
      // not a parseable URL → forward unchanged
    }
    if (host !== kapsoHost) return original(input as RequestInfo, init)

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    const auth = headers.get('authorization') ?? headers.get('Authorization')
    if (auth?.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim()
      headers.delete('authorization')
      headers.delete('Authorization')
      if (!headers.has('x-api-key')) headers.set('x-api-key', token)
    }
    const nextInit: RequestInit = { ...init, headers }
    return original(input as RequestInfo, nextInit)
  }
}

export function getWhatsAppAdapter(): ReturnType<typeof createWhatsAppAdapter> {
  if (adapter) return adapter
  patchFetchForKapso()
  const env = getEnv()
  adapter = createWhatsAppAdapter({
    accessToken: env.KAPSO_API_KEY,
    apiUrl: `${env.KAPSO_GRAPH_API_URL.replace(/\/$/, '')}/meta/whatsapp`,
    apiVersion: 'v24.0',
    appSecret: env.KAPSO_WEBHOOK_SECRET,
    phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
    userName: env.BOT_USERNAME,
    verifyToken: env.KAPSO_WEBHOOK_SECRET,
  })
  return adapter
}
