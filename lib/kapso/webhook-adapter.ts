/**
 * Kapso ↔ Chat SDK WhatsApp adapter glue.
 *
 * Decision: @chat-adapter/whatsapp@4.27.0 accepts an `apiUrl` option
 * which overrides the Meta Graph API base URL. Kapso emulates the Meta
 * Cloud API, so we can point the adapter directly at Kapso for outbound
 * calls and inbound webhook payloads (Kapso forwards Meta-shaped JSON).
 *
 * No bespoke webhook translator required — the adapter handles the
 * shape natively. If Kapso changes its base path or surface, swap
 * `KAPSO_GRAPH_API_URL` here without touching handler code.
 */
import { createWhatsAppAdapter } from '@chat-adapter/whatsapp'
import { getEnv } from '@/lib/env'

let adapter: ReturnType<typeof createWhatsAppAdapter> | null = null

export function getWhatsAppAdapter(): ReturnType<typeof createWhatsAppAdapter> {
  if (adapter) return adapter
  const env = getEnv()
  adapter = createWhatsAppAdapter({
    accessToken: env.KAPSO_API_KEY,
    apiUrl: env.KAPSO_GRAPH_API_URL,
    appSecret: env.KAPSO_WEBHOOK_SECRET,
    phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
    userName: env.BOT_USERNAME,
    verifyToken: env.KAPSO_WEBHOOK_SECRET,
  })
  return adapter
}
