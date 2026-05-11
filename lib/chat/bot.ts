import { Chat } from 'chat'
import { createMemoryState } from '@chat-adapter/state-memory'
import { createRedisState } from '@chat-adapter/state-redis'
import { getEnv } from '@/lib/env'
import { getKapsoWhatsAppAdapter } from '@/lib/kapso/whatsapp-adapter'
import { registerHandlers } from './handlers'

type Adapters = { whatsapp: ReturnType<typeof getKapsoWhatsAppAdapter> }

let cached: Chat<Adapters> | null = null
let warnedMemoryState = false

function getStateStore(redisUrl: string | undefined) {
  if (redisUrl) return createRedisState({ url: redisUrl })
  if (!warnedMemoryState) {
    warnedMemoryState = true
    console.warn(
      '[bot] REDIS_URL not set — using in-memory dedupe/lock/history. ' +
        'Safe for local dev/demo; production deploys require TCP Redis.',
    )
  }
  return createMemoryState()
}

/**
 * Returns the process-wide Chat SDK bot instance.
 *
 * In production, `REDIS_URL` is required (enforced by the env schema's
 * refinement). In dev/test we fall back to MemoryState so `pnpm dev`
 * boots without TCP Redis configured — but warn once so the operator
 * knows dedupe / locks / thread history are per-instance.
 */
export function getBot(): Chat<Adapters> {
  if (cached) return cached
  const env = getEnv()
  const state = getStateStore(env.REDIS_URL)

  cached = new Chat<Adapters>({
    userName: env.BOT_USERNAME,
    adapters: { whatsapp: getKapsoWhatsAppAdapter() },
    state,
    dedupeTtlMs: 600_000,
    // The agent stream may run several seconds; allow new messages on
    // the same thread to take over instead of being dropped.
    onLockConflict: 'force',
  })

  registerHandlers(cached)
  return cached
}
