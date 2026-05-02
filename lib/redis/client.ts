import { Redis } from '@upstash/redis'
import { getEnv } from '@/lib/env'

let client: Redis | null = null

/**
 * Returns a process-wide Upstash Redis client.
 * Uses REST (not TCP), so it's serverless-friendly and works on
 * Vercel Fluid Compute. The Chat SDK's state-redis adapter uses a
 * different (TCP) connection.
 */
export function getRedisClient(): Redis {
  if (client) return client
  const env = getEnv()
  client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })
  return client
}

// Convenience export matching V0_PROMPT.md style.
export const redis = new Proxy({} as Redis, {
  get(_t, prop) {
    return Reflect.get(getRedisClient(), prop)
  },
})
