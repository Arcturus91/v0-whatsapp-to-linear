/**
 * Kapso v2 webhook payload → Meta WhatsApp Cloud API webhook payload.
 *
 * Kapso sandbox configs ONLY support v2 (their native shape with
 * X-Webhook-Event headers), not the Meta-forward mode our chat-adapter
 * expects. We translate so we can reuse @chat-adapter/whatsapp.
 *
 * Source schema: https://docs.kapso.ai/docs/platform/webhooks/event-types
 */

type KapsoMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction'
  | 'button'
  | 'interactive'
  | 'unknown'

interface KapsoInboundBody {
  message: {
    id: string
    timestamp: string
    type: KapsoMessageType
    from: string
    text?: { body: string }
    image?: { id?: string; mime_type?: string; sha256?: string; caption?: string }
    audio?: { id?: string; mime_type?: string; voice?: boolean }
    video?: { id?: string; mime_type?: string; caption?: string }
    document?: { id?: string; mime_type?: string; filename?: string; caption?: string }
    kapso?: { content?: string; has_media?: boolean }
  }
  conversation: {
    id: string
    phone_number_id?: string
    kapso?: { contact_name?: string }
  }
  phone_number_id: string
}

export interface MetaWebhookBody {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      field: 'messages'
      value: {
        messaging_product: 'whatsapp'
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts: Array<{
          profile: { name: string }
          wa_id: string
        }>
        messages: Array<MetaInboundMessage>
      }
    }>
  }>
}

type MetaInboundMessage =
  | {
      from: string
      id: string
      timestamp: string
      type: 'text'
      text: { body: string }
    }
  | {
      from: string
      id: string
      timestamp: string
      type: 'image' | 'audio' | 'video' | 'document'
      [mediaKey: string]: unknown
    }

export function isKapsoV2Request(req: Request): boolean {
  return (
    req.headers.get('x-webhook-payload-version') === 'v2' ||
    req.headers.has('x-webhook-event')
  )
}

export function translateKapsoToMeta(body: KapsoInboundBody): MetaWebhookBody {
  const { message, conversation, phone_number_id } = body
  const wa_id = message.from
  const contactName = conversation.kapso?.contact_name ?? wa_id

  let metaMessage: MetaInboundMessage
  if (message.type === 'text' && message.text?.body) {
    metaMessage = {
      from: wa_id,
      id: message.id,
      timestamp: message.timestamp,
      type: 'text',
      text: { body: message.text.body },
    }
  } else if (message.type === 'audio' && message.audio) {
    metaMessage = {
      from: wa_id,
      id: message.id,
      timestamp: message.timestamp,
      type: 'audio',
      audio: message.audio,
    }
  } else if (message.type === 'image' && message.image) {
    metaMessage = {
      from: wa_id,
      id: message.id,
      timestamp: message.timestamp,
      type: 'image',
      image: message.image,
    }
  } else if (message.type === 'video' && message.video) {
    metaMessage = {
      from: wa_id,
      id: message.id,
      timestamp: message.timestamp,
      type: 'video',
      video: message.video,
    }
  } else if (message.type === 'document' && message.document) {
    metaMessage = {
      from: wa_id,
      id: message.id,
      timestamp: message.timestamp,
      type: 'document',
      document: message.document,
    }
  } else {
    // Fallback: treat as text using kapso.content if available.
    metaMessage = {
      from: wa_id,
      id: message.id,
      timestamp: message.timestamp,
      type: 'text',
      text: { body: message.kapso?.content ?? '' },
    }
  }

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: phone_number_id,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: phone_number_id,
                phone_number_id,
              },
              contacts: [
                {
                  profile: { name: contactName },
                  wa_id,
                },
              ],
              messages: [metaMessage],
            },
          },
        ],
      },
    ],
  }
}

/** Only message-arrival events route to the bot. */
export function isInboundMessageEvent(headerEvent: string | null): boolean {
  return (
    headerEvent === 'whatsapp.message.received' ||
    headerEvent === 'whatsapp.message_received'
  )
}
