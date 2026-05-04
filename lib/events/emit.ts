import { redis, getRedisClient } from '@/lib/redis/client'
import type {
  ConversationEvent,
  ConversationState,
  LinearEvent,
  StreamEvent,
  WhatsAppMessage,
} from './types'

const STREAM_KEY = 'linearvoice:events'
const EVENTS_LIST_KEY = 'linearvoice:event_ids'
const TTL_SEC = 60 * 60 * 24 // 24h auto-cleanup

/**
 * Emit a StreamEvent to the linearvoice:events:* keyspace (PM's contract)
 * AND maintain backend aggregate keys consumed by /api/conversations,
 * /api/issues, /api/metrics.
 */
export async function emitStreamEvent(event: StreamEvent): Promise<void> {
  const client = getRedisClient()
  const eventId = `${event.timestamp}-${Math.random().toString(36).slice(2, 8)}`
  const serialized = JSON.stringify({
    id: eventId,
    type: event.type,
    payload: JSON.stringify(event.payload),
    timestamp: event.timestamp.toString(),
  })

  await client.set(`${STREAM_KEY}:${eventId}`, serialized, { ex: TTL_SEC })
  await client.lpush(EVENTS_LIST_KEY, eventId)
  await client.ltrim(EVENTS_LIST_KEY, 0, 999)

  // Backend aggregates (consumed by /api/* REST endpoints).
  await client.hincrby('metrics:counters', `total:${event.type}`, 1)
  await client.expire('metrics:counters', TTL_SEC)

  const conversationId = deriveConversationId(event)
  if (conversationId) {
    await client.zadd('conversations:active', {
      score: event.timestamp,
      member: conversationId,
    })
    await client.expire('conversations:active', TTL_SEC)

    const listKey = `conversation:${conversationId}:messages`
    await client.rpush(listKey, serialized)
    await client.expire(listKey, TTL_SEC)
  }

  if (event.type === 'linear.event') {
    const linear = event.payload as LinearEvent
    if (linear.issueId) await trackIssue(linear.issueId).catch(() => {})
  }
}

function deriveConversationId(event: StreamEvent): string | null {
  if (event.type === 'whatsapp.message') {
    const payload = event.payload as WhatsAppMessage
    return payload.from || null
  }
  if (
    event.type === 'bot.response' ||
    event.type === 'voice.transcribed'
  ) {
    const payload = event.payload as ConversationEvent
    return payload.conversationId || null
  }
  return null
}

export async function emitWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  await emitStreamEvent({
    type: 'whatsapp.message',
    payload: message,
    timestamp: message.timestamp || Date.now(),
  })
}

export async function emitLinearEvent(event: LinearEvent): Promise<void> {
  await emitStreamEvent({
    type: 'linear.event',
    payload: event,
    timestamp: event.timestamp || Date.now(),
  })
}

export async function emitBotResponse(conversation: ConversationEvent): Promise<void> {
  await emitStreamEvent({
    type: 'bot.response',
    payload: conversation,
    timestamp: conversation.timestamp || Date.now(),
  })
}

export async function emitVoiceTranscribed(transcript: ConversationEvent): Promise<void> {
  await emitStreamEvent({
    type: 'voice.transcribed',
    payload: transcript,
    timestamp: transcript.timestamp || Date.now(),
  })
}

export async function trackIssue(issueId: string): Promise<void> {
  if (!issueId) return
  await redis.sadd('issues:touched', issueId)
  await redis.expire('issues:touched', TTL_SEC)
}

export async function saveConversationState(
  conversationId: string,
  state: ConversationState | Record<string, unknown>,
): Promise<void> {
  const client = getRedisClient()
  await client.set(`conversation:${conversationId}:state`, JSON.stringify(state), {
    ex: TTL_SEC,
  })
}

export async function getConversationState<T = ConversationState>(
  conversationId: string,
): Promise<T | null> {
  const client = getRedisClient()
  const data = await client.get(`conversation:${conversationId}:state`)
  if (!data) return null
  if (typeof data === 'string') return JSON.parse(data) as T
  return data as T
}
