import { Redis } from '@upstash/redis';
import { getEnv } from '../env';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const env = getEnv();
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = getRedisClient();
    await client.ping();
    console.log('[v0] Redis connected');
  } catch (error) {
    console.error('[v0] Redis connection failed:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    redisClient = null;
  }
}
