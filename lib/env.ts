import { z } from 'zod'

const envSchema = z.object({
  // Vercel-managed (Upstash Redis Marketplace integration).
  // The Marketplace install auto-injects these names; @upstash/redis also
  // reads them via Redis.fromEnv().
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string(),
  // Optional TCP redis URL for the Chat SDK state-redis adapter (which
  // uses node-redis, not the REST API). When absent we fall back to the
  // memory state adapter — fine for the demo.
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

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

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
