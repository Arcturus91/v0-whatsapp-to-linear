import { redis } from '@/lib/redis/client'
import type { DemoEvent } from '@/lib/events/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  const raw = ((await redis.lrange(
    `conversation:${id}:messages`,
    0,
    -1,
  )) ?? []) as string[]
  const events: DemoEvent[] = []
  for (const entry of raw) {
    try {
      events.push(JSON.parse(entry) as DemoEvent)
    } catch {
      // skip malformed
    }
  }
  return Response.json({ id, events })
}
