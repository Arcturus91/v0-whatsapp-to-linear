import { Buffer } from 'node:buffer'
import { createWhatsAppAdapter, type WhatsAppAdapter } from '@chat-adapter/whatsapp'
import { getEnv } from '@/lib/env'
import { downloadMedia as kapsoDownloadMedia } from './media'

/**
 * Kapso ↔ Chat SDK WhatsApp adapter glue (scoped, no global side effects).
 *
 * The official @chat-adapter/whatsapp (pinned to ^4.27.0 in package.json)
 * targets Meta's Graph API and hard-codes `Authorization: Bearer <token>`.
 * Kapso emulates the same surface but authenticates via `X-API-Key`. We
 * reassign the two HTTP-touching methods on the single adapter instance
 * the bot uses, instead of mutating globalThis.fetch:
 *
 *   - graphApiRequest(path, body)  — POST to {phoneNumberId}/messages, etc.
 *                                    Called by postMessage, addReaction,
 *                                    removeReaction, startTyping,
 *                                    markAsRead, initialize.
 *   - downloadMedia(mediaId)       — GET media metadata + binary. Called
 *                                    directly and via the closure in
 *                                    buildMediaAttachment, so the swap
 *                                    reaches inbound STT attachments too.
 *
 * If a future @chat-adapter/whatsapp release renames or restructures
 * either method, TypeScript won't catch it (we cast through `unknown`)
 * and inbound/outbound calls will throw at runtime. The smoke check
 * `scripts/smoke-no-fetch-patch.mjs` plus an integration test on the
 * webhook route is the safety net.
 */

interface InstanceOverrides {
  graphApiRequest: (path: string, body: unknown) => Promise<unknown>
  downloadMedia: (mediaId: string) => Promise<Buffer>
}

let adapter: WhatsAppAdapter | null = null

export function getKapsoWhatsAppAdapter(): WhatsAppAdapter {
  if (adapter) return adapter
  const env = getEnv()
  const inner = createWhatsAppAdapter({
    accessToken: env.KAPSO_API_KEY,
    apiUrl: `${env.KAPSO_GRAPH_API_URL.replace(/\/$/, '')}/meta/whatsapp`,
    apiVersion: 'v24.0',
    appSecret: env.KAPSO_WEBHOOK_SECRET,
    phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
    userName: env.BOT_USERNAME,
    verifyToken: env.KAPSO_WEBHOOK_SECRET,
  })

  const overrides = inner as unknown as InstanceOverrides
  const graphBase = `${env.KAPSO_GRAPH_API_URL.replace(/\/$/, '')}/meta/whatsapp/v24.0`

  overrides.graphApiRequest = async (path, body) => {
    const res = await fetch(`${graphBase}${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': env.KAPSO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Kapso ${res.status} ${path}: ${errBody.slice(0, 500)}`)
    }
    return res.json()
  }

  overrides.downloadMedia = async (mediaId) =>
    (await kapsoDownloadMedia(mediaId)).buffer

  adapter = inner
  return adapter
}
