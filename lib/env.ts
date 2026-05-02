import { z } from 'zod';

const envSchema = z.object({
  // Redis (Upstash)
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  // Kapso WhatsApp API
  KAPSO_API_BASE: z.string().url().default('https://api.kapso.io'),
  KAPSO_AUTH_TOKEN: z.string(),
  KAPSO_PHONE_ID: z.string(),

  // Linear API & MCP
  LINEAR_API_KEY: z.string(),
  LINEAR_MCP_ENABLED: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),

  // ElevenLabs (Voice)
  ELEVENLABS_API_KEY: z.string(),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),

  // Webhook verification
  WEBHOOK_SECRET: z.string(),

  // Feature flags
  ENABLE_VOICE: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  ENABLE_REDIS_PERSISTENCE: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function validateEnv(): Env {
  if (env) return env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.flatten());
    throw new Error('Invalid environment variables');
  }

  env = result.data;
  return env;
}

export function getEnv(): Env {
  if (!env) {
    validateEnv();
  }
  return env!;
}

export type { Env };
