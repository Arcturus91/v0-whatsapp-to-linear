import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

/**
 * Pure auth gate for /api/test/send. Kept side-effect-free so a smoke
 * script can compile this file alone and unit-test the prod cases
 * without booting Next.
 *
 * Result kinds:
 *   - { kind: 'allow' }                       — proceed to the handler
 *   - { kind: 'deny', status: 404 }           — pretend endpoint doesn't exist
 *   - { kind: 'deny', status: 401 }           — Bearer absent or wrong
 */
export type GateResult = { kind: 'allow' } | { kind: 'deny'; status: 404 | 401 }

export function gateProdAuth(input: {
  authHeader: string | null
  secret: string | undefined
}): GateResult {
  if (!input.secret) return { kind: 'deny', status: 404 }
  const presented = (input.authHeader ?? '').startsWith('Bearer ')
    ? (input.authHeader ?? '').slice(7).trim()
    : ''
  if (!safeEqualString(presented, input.secret)) {
    return { kind: 'deny', status: 401 }
  }
  return { kind: 'allow' }
}

export function extractClientIp(forwardedFor: string | null): string {
  const first = (forwardedFor ?? '').split(',')[0]?.trim()
  return first || '127.0.0.1'
}

function safeEqualString(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(presented), Buffer.from(expected))
  } catch {
    return false
  }
}
