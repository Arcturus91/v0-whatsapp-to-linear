/**
 * Rate limiters backed by Upstash Redis INCR+EXPIRE.
 *
 *   - checkRateLimit(phone)  — per-WhatsApp-number burst (10/60s) +
 *                              daily cap (100/24h). Used by
 *                              lib/chat/handlers.ts on the inbound
 *                              hot path to bound runaway users.
 *   - checkIpRateLimit(ip)   — per-IP burst (5/60s). Used by the dev
 *                              path of /api/test/send to bound a
 *                              curious laptop hammering localhost.
 *
 * checkRateLimit fails OPEN on Redis errors (don't block real users due
 * to Redis flakiness). checkIpRateLimit fails CLOSED — see its docblock.
 * #4 layers a circuit breaker on top.
 */
import { getRedisClient } from '@/lib/redis/client'

const MINUTE_LIMIT = 10
const MINUTE_TTL = 60
const DAY_LIMIT = 100
const DAY_TTL = 60 * 60 * 24

const IP_LIMIT = 5
const IP_TTL = 60

export interface RateLimitResult {
  allowed: boolean
  reason?: 'minute' | 'day' | 'ip' | 'redis_unavailable'
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

/**
 * IP-based limiter for the dev path of /api/test/send. Fail-CLOSED on
 * Redis errors: in dev there's no bearer secret protecting the
 * endpoint, and dev servers are routinely exposed via tunnels (ngrok,
 * cloudflared) for Kapso testing. A silent Redis outage must not
 * silently unlock the endpoint.
 *
 * The per-phone `checkRateLimit` keeps its fail-open semantics — real
 * users on the inbound hot path shouldn't be blocked by Redis flakiness.
 */
export async function checkIpRateLimit(ip: string): Promise<RateLimitResult> {
  if (!ip) return { allowed: true }
  const key = `ratelimit:ip:${ip}`
  try {
    const count = await bumpCounter(key, IP_TTL)
    if (count > IP_LIMIT) {
      const ttl = await safeTtl(key, IP_TTL)
      return { allowed: false, reason: 'ip', retryAfterSeconds: ttl }
    }
    return { allowed: true }
  } catch (err) {
    console.error('[rate-limit] ip check failed, denying:', err)
    return { allowed: false, reason: 'redis_unavailable' }
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
