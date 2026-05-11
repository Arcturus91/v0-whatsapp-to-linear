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
 * Per-call failure handling:
 *   - checkRateLimit fails OPEN — single Redis blip lets one user
 *     through, which beats blocking real traffic.
 *   - checkIpRateLimit fails CLOSED — dev tunnels expose the test
 *     endpoint with no bearer covering us.
 *
 * Sustained-failure handling (this file + circuit-breaker.ts):
 *   - Failures from BOTH limiters bump a shared counter. Past 10
 *     failures in 60s, the breaker flips open: both limiters short-
 *     circuit and fail CLOSED for 60s. checkRateLimit's normal fail-
 *     open semantics are NOT preserved during the open window — that's
 *     the entire point. A `rate_limiter.degraded` event is emitted
 *     once per trip so the dashboard surfaces the brownout.
 */
import { getRedisClient } from '@/lib/redis/client'
import { emitStreamEvent } from '@/lib/events/emit'
import {
  BREAKER_CONSTANTS,
  isBreakerOpen,
  recordRedisFailure,
  recordRedisSuccess,
} from './circuit-breaker'

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
  if (isBreakerOpen()) {
    return { allowed: false, reason: 'redis_unavailable' }
  }

  const minuteKey = `ratelimit:min:${phoneNumber}`
  const dayKey = `ratelimit:day:${phoneNumber}`

  try {
    const [minuteCount, dayCount] = await Promise.all([
      bumpCounter(minuteKey, MINUTE_TTL),
      bumpCounter(dayKey, DAY_TTL),
    ])
    recordRedisSuccess()

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
    recordRedisFailure(emitDegradedFireAndForget)
    // Fail-open per-call (still under the breaker threshold) — never
    // block real users on a one-off Redis blip.
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
  if (isBreakerOpen()) {
    return { allowed: false, reason: 'redis_unavailable' }
  }
  const key = `ratelimit:ip:${ip}`
  try {
    const count = await bumpCounter(key, IP_TTL)
    recordRedisSuccess()
    if (count > IP_LIMIT) {
      const ttl = await safeTtl(key, IP_TTL)
      return { allowed: false, reason: 'ip', retryAfterSeconds: ttl }
    }
    return { allowed: true }
  } catch (err) {
    recordRedisFailure(emitDegradedFireAndForget)
    console.error('[rate-limit] ip check failed, denying:', err)
    return { allowed: false, reason: 'redis_unavailable' }
  }
}

function emitDegradedFireAndForget(): void {
  // Best-effort: if Redis is broken enough to trip the breaker, the
  // event emit (also Redis-backed) is likely to fail. The breaker's
  // console.error is the load-bearing observability path; this is just
  // the dashboard signal when Redis is flaky-not-dead.
  void emitStreamEvent({
    type: 'rate_limiter.degraded',
    payload: {
      reason: 'redis_failures_exceeded_threshold',
      failuresInWindow: BREAKER_CONSTANTS.FAILURE_THRESHOLD + 1,
      openForSeconds: BREAKER_CONSTANTS.OPEN_DURATION_MS / 1000,
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
  }).catch(() => {})
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
