import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const issues = ((await redis.smembers('issues:touched')) ?? []) as string[]
  return Response.json({ issues })
}
