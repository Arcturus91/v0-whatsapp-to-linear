/**
 * Per-WhatsApp-number rate limiter (burst + daily cap).
 *
 * Uses Upstash Redis INCR with EXPIRE-on-first-hit so each window has
 * its own TTL and resets cleanly. Two independent counters per number:
 *   - ratelimit:min:{phone}  — 10 per 60s   (burst)
 *   - ratelimit:day:{phone}  — 100 per 24h  (daily cap)
 *
 * Used by lib/chat/handlers.ts at the very top of the inbound handler
 * to keep curious LinkedIn visitors from blowing up the bill.
 */
import { getRedisClient } from '@/lib/redis/client'

const MINUTE_LIMIT = 10
const MINUTE_TTL = 60
const DAY_LIMIT = 100
const DAY_TTL = 60 * 60 * 24

export interface RateLimitResult {
  allowed: boolean
  reason?: 'minute' | 'day'
  retryAfterSeconds?: number
}

export async function checkRateLimit(phoneNumber: string): Promise<RateLimitResult> {
  if (!phoneNumber || phoneNumber === 'unknown') {
    return { allowed: true }
  }

  const client = getRedisClient()
  const minuteKey = `ratelimit:min:${phoneNumber}`
  const dayKey = `ratelimit:day:${phoneNumber}`

  try {
    const [minuteCount, dayCount] = await Promise.all([
      bumpCounter(minuteKey, MINUTE_TTL),
      bumpCounter(dayKey, DAY_TTL),
    ])

    if (dayCount > DAY_LIMIT) {
      const ttl = await safeTtl(dayKey, DAY_TTL)
      return { allowed: false, reason: 'day', retryAfterSeconds: ttl }
    }
    if (minuteCount > MINUTE_LIMIT) {
      const ttl = await safeTtl(minuteKey, MINUTE_TTL)
      return { allowed: false, reason: 'minute', retryAfterSeconds: ttl }
    }
    return { allowed: true }
  } catch (err) {
    // Fail-open: never block real users due to Redis flakiness.
    console.warn('[rate-limit] check failed, allowing:', err)
    return { allowed: true }
  }
}

async function bumpCounter(key: string, ttlSeconds: number): Promise<number> {
  const client = getRedisClient()
  const count = await client.incr(key)
  if (count === 1) {
    await client.expire(key, ttlSeconds)
  }
  return count
}

async function safeTtl(key: string, fallback: number): Promise<number> {
  const client = getRedisClient()
  try {
    const ttl = await client.ttl(key)
    return ttl > 0 ? ttl : fallback
  } catch {
    return fallback
  }
}
