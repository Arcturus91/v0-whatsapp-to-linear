import { z } from 'zod'

export const envSchema = z.object({
  // Vercel-managed (Upstash Redis Marketplace integration).
  // The Marketplace install auto-injects these names; @upstash/redis also
  // reads them via Redis.fromEnv().
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string(),
  // TCP redis URL for the Chat SDK state-redis adapter (which uses
  // node-redis, not the Upstash REST API). Required in production —
  // without it dedupe / locks / thread history are per-instance, which
  // silently breaks correctness across Fluid Compute cold starts.
  // Optional in dev/test so `pnpm dev` boots without it (memory state
  // fallback).
  REDIS_URL: z.string().url().optional(),

  // AI Gateway — at least one must be present in production but both are
  // optional locally so dev boots without them.
  AI_GATEWAY_API_KEY: z.string().optional(),
  VERCEL_OIDC_TOKEN: z.string().optional(),

  // Kapso (WhatsApp Cloud API proxy)
  KAPSO_API_KEY: z.string().min(1),
  KAPSO_API_BASE: z.string().url().default('https://api.kapso.ai'),
  KAPSO_WEBHOOK_SECRET: z.string().min(1),
  KAPSO_PHONE_NUMBER_ID: z.string().min(1),
  // The Cloud API base used by the Chat SDK whatsapp adapter for
  // outbound calls. Kapso emulates the Meta Graph API; default to that.
  KAPSO_GRAPH_API_URL: z.string().url().default('https://graph.facebook.com'),

  // Linear (optional in step 2 so the project boots before MCP is wired)
  LINEAR_OAUTH_TOKEN: z.string().optional(),

  // ElevenLabs (optional in step 2; required in step 5)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('JBFqnCBsd6RMkjVDRZzb'),

  // Bot config
  BOT_USERNAME: z.string().default('linearvoice'),

  // Optional bearer secret that gates POST /api/test/send.
  // In production: if unset the endpoint 404s; if set callers must
  // present `Authorization: Bearer ${TEST_ENDPOINT_SECRET}`. In dev the
  // endpoint is open (IP-rate-limited).
  TEST_ENDPOINT_SECRET: z.string().min(1).optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).refine(
  (data) => data.NODE_ENV !== 'production' || !!data.REDIS_URL,
  {
    message:
      'REDIS_URL is required in production. It is the TCP URL for ' +
      '@chat-adapter/state-redis (separate from KV_REST_API_URL). The ' +
      'Vercel Upstash integration auto-injects it; pull with ' +
      '`vercel env pull` or check Storage > Upstash.',
    path: ['REDIS_URL'],
  },
)

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function validateEnv(): Env {
  if (cached) return cached
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('[env] validation failed:', result.error.flatten())
    throw new Error('Invalid environment variables')
  }
  cached = result.data
  return cached
}

export function getEnv(): Env {
  if (!cached) validateEnv()
  return cached!
}

// Convenience accessor — call sites use `env.X` like the spec.
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env]
  },
})
