import { redis } from '@/lib/redis/client'
import type { DemoEvent } from './types'

const STREAM_KEY = 'events:stream'
const TTL_SEC = 60 * 60 * 24 // 24h auto-cleanup

/**
 * Emit a single event to the demo Redis Stream.
 * Mirrors keys onto per-conversation lists + active-conversations zset
 * so the dashboard REST endpoints can read them cheaply.
 */
export async function emit(event: DemoEvent): Promise<void> {
  const payload = JSON.stringify(event)
  // XADD events:stream * payload <json>
  await redis.xadd(STREAM_KEY, '*', { payload })
  await redis.expire(STREAM_KEY, TTL_SEC)

  if ('conversationId' in event && event.conversationId) {
    const id = event.conversationId
    await redis.zadd('conversations:active', {
      score: event.ts,
      member: id,
    })
    await redis.expire('conversations:active', TTL_SEC)

    const listKey = `conversation:${id}:messages`
    await redis.rpush(listKey, payload)
    await redis.expire(listKey, TTL_SEC)
  }

  // Lightweight aggregate counters for /api/metrics.
  await redis.hincrby('metrics:counters', `total:${event.type}`, 1)
  await redis.expire('metrics:counters', TTL_SEC)
}

export async function trackIssue(issueId: string): Promise<void> {
  if (!issueId) return
  await redis.sadd('issues:touched', issueId)
  await redis.expire('issues:touched', TTL_SEC)
}
