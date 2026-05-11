/**
 * Circuit breaker for the Redis-backed rate limiters in this directory.
 *
 * The per-phone limiter (`checkRateLimit`) fails OPEN on a single Redis
 * blip — correct for one flaky call, but disastrous if Redis is
 * sustained-broken because the rate limiter is effectively disabled
 * and a curious visitor can burn the AI Gateway budget. This module
 * tracks failures across a sliding window and, past a threshold, flips
 * both limiters fail-closed for a cooldown.
 *
 * Pure state machine: injectable clock, test reset hook, no Redis/HTTP
 * dependencies. The caller (rate-limit.ts) hands in an `onTrip`
 * callback used to fire a `rate_limiter.degraded` stream event so the
 * dashboard sees the brownout.
 */

const FAILURE_WINDOW_MS = 60_000
const FAILURE_THRESHOLD = 10
const OPEN_DURATION_MS = 60_000

interface BreakerState {
  failures: number[]
  openUntil: number
  degradedEmitted: boolean
}

const state: BreakerState = {
  failures: [],
  openUntil: 0,
  degradedEmitted: false,
}

let nowFn: () => number = Date.now

export function setClockForTesting(fn: () => number): void {
  nowFn = fn
}

export function resetBreakerForTesting(): void {
  state.failures = []
  state.openUntil = 0
  state.degradedEmitted = false
}

export function isBreakerOpen(): boolean {
  return nowFn() < state.openUntil
}

export function recordRedisFailure(onTrip?: () => void): void {
  const now = nowFn()
  state.failures = state.failures.filter((ts) => now - ts < FAILURE_WINDOW_MS)
  state.failures.push(now)
  if (state.failures.length > FAILURE_THRESHOLD && state.openUntil <= now) {
    state.openUntil = now + OPEN_DURATION_MS
    console.error(
      `[rate-limit] circuit breaker tripped — ${state.failures.length} Redis failures in ${FAILURE_WINDOW_MS / 1000}s. Failing closed for ${OPEN_DURATION_MS / 1000}s.`,
    )
    if (!state.degradedEmitted) {
      state.degradedEmitted = true
      onTrip?.()
    }
  }
}

export function recordRedisSuccess(): void {
  if (nowFn() >= state.openUntil) state.degradedEmitted = false
}

/**
 * Read-only snapshot for /api/health. Recomputes the in-window failure
 * count on each call so the dashboard sees stale entries decay.
 */
export function getBreakerSnapshot(): {
  open: boolean
  failuresInWindow: number
  openForSeconds: number
} {
  const now = nowFn()
  const failuresInWindow = state.failures.filter(
    (ts) => now - ts < FAILURE_WINDOW_MS,
  ).length
  const openForSeconds =
    state.openUntil > now ? Math.ceil((state.openUntil - now) / 1000) : 0
  return { open: now < state.openUntil, failuresInWindow, openForSeconds }
}

export const BREAKER_CONSTANTS = {
  FAILURE_WINDOW_MS,
  FAILURE_THRESHOLD,
  OPEN_DURATION_MS,
}
