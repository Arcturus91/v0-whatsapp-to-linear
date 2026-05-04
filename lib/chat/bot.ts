import { Chat } from 'chat'
import { createMemoryState } from '@chat-adapter/state-memory'
import { createRedisState } from '@chat-adapter/state-redis'
import { getEnv } from '@/lib/env'
import { getWhatsAppAdapter } from '@/lib/kapso/webhook-adapter'
import { registerHandlers } from './handlers'

type Adapters = { whatsapp: ReturnType<typeof getWhatsAppAdapter> }

let cached: Chat<Adapters> | null = null

/**
 * Returns the process-wide Chat SDK bot instance.
 * Falls back to MemoryState if no TCP-style REDIS_URL is configured —
 * Upstash's REST URL is not compatible with the state-redis adapter
 * (which uses node-redis under the hood), so we keep memory state
 * as a deliberate dev/demo fallback.
 */
export function getBot(): Chat<Adapters> {
  if (cached) return cached
  const env = getEnv()

  const state = env.REDIS_URL
    ? createRedisState({ url: env.REDIS_URL })
    : createMemoryState()

  cached = new Chat<Adapters>({
    userName: env.BOT_USERNAME,
    adapters: { whatsapp: getWhatsAppAdapter() },
    state,
    dedupeTtlMs: 600_000,
    // The agent stream may run several seconds; allow new messages on
    // the same thread to take over instead of being dropped.
    onLockConflict: 'force',
  })

  registerHandlers(cached)
  return cached
}
