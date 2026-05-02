import { redis } from '@/lib/redis/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const [counters, totalConversations, issuesTouched] = await Promise.all([
    redis.hgetall('metrics:counters') as Promise<Record<string, string>>,
    redis.zcard('conversations:active') as Promise<number>,
    redis.scard('issues:touched') as Promise<number>,
  ])
  return Response.json({
    counters: counters ?? {},
    totalConversations: totalConversations ?? 0,
    issuesTouched: issuesTouched ?? 0,
  })
}
