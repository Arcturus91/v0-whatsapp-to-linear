import { Buffer } from 'node:buffer'
import { kapsoFetch } from './client'

export interface DownloadedMedia {
  buffer: Buffer
  mimeType: string
}

/**
 * Two-step Meta-style media download:
 *   1. GET /v1/media/{id}            → metadata + signed url
 *   2. GET <metadata.url>            → binary
 *
 * Falls back gracefully if Kapso returns the binary directly.
 */
export async function downloadMedia(mediaId: string): Promise<DownloadedMedia> {
  const metaRes = await kapsoFetch(`/v1/media/${encodeURIComponent(mediaId)}`)
  const contentType = metaRes.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; mimeType?: string }
    if (!meta.url) {
      throw new Error(`Kapso media ${mediaId} returned no download url`)
    }
    const fileRes = await kapsoFetch(meta.url)
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    return {
      buffer,
      mimeType: meta.mime_type ?? meta.mimeType ?? fileRes.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

  const buffer = Buffer.from(await metaRes.arrayBuffer())
  return { buffer, mimeType: contentType || 'application/octet-stream' }
}

/**
 * Upload a binary blob to Kapso for use as a WhatsApp message attachment.
 * Returns the Kapso media id.
 */
export async function uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), 'reply.bin')
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimeType)

  const res = await kapsoFetch('/v1/media', { method: 'POST', body: form })
  const json = (await res.json()) as { id?: string; mediaId?: string }
  const id = json.id ?? json.mediaId
  if (!id) {
    throw new Error('Kapso upload returned no media id')
  }
  return id
}
