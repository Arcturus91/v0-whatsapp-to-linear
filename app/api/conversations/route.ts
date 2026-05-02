import { redis } from '@/lib/redis/client'
import type { DemoEvent } from '@/lib/events/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const ids = ((await redis.zrange('conversations:active', 0, -1, {
    rev: true,
  })) ?? []) as string[]

  const items = await Promise.all(
    ids.map(async (id) => {
      const raw = ((await redis.lrange(
        `conversation:${id}:messages`,
        -1,
        -1,
      )) ?? []) as string[]
      let lastMessage: DemoEvent | null = null
      if (raw[0]) {
        try {
          lastMessage = JSON.parse(raw[0]) as DemoEvent
        } catch {
          lastMessage = null
        }
      }
      return { id, lastMessage }
    }),
  )

  return Response.json({ conversations: items })
}
