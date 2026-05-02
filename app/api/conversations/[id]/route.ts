import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StoredEnvelope = {
  id: string
  type: string
  payload: string
  timestamp: string
}

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
  const events: StoredEnvelope[] = []
  for (const entry of raw) {
    try {
      events.push(JSON.parse(entry) as StoredEnvelope)
    } catch {
      // skip malformed
    }
  }
  return Response.json({ id, events })
}
