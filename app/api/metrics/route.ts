import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  try {
    const [counters, totalConversations, issuesTouched] = await Promise.all([
      redis.hgetall('metrics:counters') as Promise<Record<string, string | number> | null>,
      redis.zcard('conversations:active') as Promise<number>,
      redis.scard('issues:touched') as Promise<number>,
    ])

    const safeCounters = counters ?? {}
    const eventTypes: Record<string, number> = {}
    let totalEvents = 0
    for (const [key, raw] of Object.entries(safeCounters)) {
      if (!key.startsWith('total:')) continue
      const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
      if (Number.isNaN(value)) continue
      const type = key.slice('total:'.length)
      eventTypes[type] = value
      totalEvents += value
    }

    return Response.json({
      // Fields consumed by the dashboard client component.
      totalEvents,
      eventTypes,
      // Original fields kept for backwards compatibility.
      counters: safeCounters,
      totalConversations: totalConversations ?? 0,
      issuesTouched: issuesTouched ?? 0,
    })
  } catch (error) {
    console.error('[v0] Metrics API error:', error)
    return Response.json(
      {
        totalEvents: 0,
        eventTypes: {},
        counters: {},
        totalConversations: 0,
        issuesTouched: 0,
        error: 'Failed to fetch metrics',
      },
      { status: 500 }
    )
  }
}
