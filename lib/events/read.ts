import { redis } from '@/lib/redis/client'
import type { DemoEvent } from './types'

const STREAM_KEY = 'events:stream'

export type StoredEvent = DemoEvent & { id: string }

/**
 * Read events from the Redis stream after a given last-seen id (default
 * `-` for all). Upstash REST does not support BLOCK so callers should
 * poll with their own delay between reads.
 */
export async function readSince(
  lastId: string = '-',
  count: number = 100,
): Promise<StoredEvent[]> {
  // Inclusive of `lastId`; we filter it out below.
  const start = lastId === '-' || lastId === '$' ? '-' : `(${lastId}`
  const range = (await redis.xrange(STREAM_KEY, start, '+', count)) as Record<
    string,
    { payload?: string }
  >
  if (!range || typeof range !== 'object') return []
  const ids = Object.keys(range)
  ids.sort(compareStreamIds)
  return ids.map((id) => parseEntry(id, range[id]))
}

/** Sort Redis stream IDs lexicographically by (ms, seq). */
function compareStreamIds(a: string, b: string): number {
  const [aMs, aSeq] = a.split('-').map((n) => Number.parseInt(n, 10))
  const [bMs, bSeq] = b.split('-').map((n) => Number.parseInt(n, 10))
  if (aMs !== bMs) return aMs - bMs
  return (aSeq || 0) - (bSeq || 0)
}

function parseEntry(id: string, fields: { payload?: string } | undefined): StoredEvent {
  const raw = fields?.payload
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as DemoEvent
      return { ...parsed, id }
    } catch {
      // fall through
    }
  }
  return { id, type: 'error', error: 'malformed event', ts: Date.now() }
}

/** Latest stream id (or `0` if empty), used to seed SSE polling. */
export async function latestId(): Promise<string> {
  const range = (await redis.xrevrange(STREAM_KEY, '+', '-', 1)) as Record<
    string,
    unknown
  >
  if (!range) return '0'
  const ids = Object.keys(range)
  return ids[0] ?? '0'
}
