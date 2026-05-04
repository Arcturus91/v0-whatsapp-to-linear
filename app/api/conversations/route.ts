import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StoredEnvelope = {
  id: string
  type: string
  payload: string
  timestamp: string
}

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
      let lastMessage: StoredEnvelope | null = null
      if (raw[0]) {
        try {
          lastMessage = JSON.parse(raw[0]) as StoredEnvelope
        } catch {
          lastMessage = null
        }
      }
      return { id, lastMessage }
    }),
  )

  return Response.json({ conversations: items })
}
