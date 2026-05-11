import { redis } from '@/lib/redis/client'
import { getEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'ok' | 'degraded' | 'fail'

export async function GET(): Promise<Response> {
  let env: ReturnType<typeof getEnv> | null = null
  try {
    env = getEnv()
  } catch {
    return Response.json(
      {
        ok: false,
        checks: {
          env: 'fail',
        },
      },
      { status: 500 },
    )
  }

  const checks: Record<string, Status> = {}
  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'fail'
  }
  // Chat SDK state backing: 'ok' when TCP Redis is wired (cross-instance
  // dedupe/locks/history), 'degraded' for dev memory fallback, 'fail' if
  // we're somehow in prod without it (the env refinement should already
  // have killed boot — defensive only).
  const isProd = env.NODE_ENV === 'production'
  checks.dedupeState = env.REDIS_URL ? 'ok' : isProd ? 'fail' : 'degraded'
  checks.kapso = env.KAPSO_API_KEY ? 'ok' : 'fail'
  checks.linear = env.LINEAR_OAUTH_TOKEN ? 'ok' : 'fail'
  checks.elevenlabs = env.ELEVENLABS_API_KEY ? 'ok' : 'fail'
  checks.aiGateway = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN ? 'ok' : 'fail'

  // `degraded` is intentionally not a failure: dev/demo deploys are still
  // healthy enough to serve. Only `fail` flips the top-level ok.
  const ok = Object.values(checks).every((v) => v !== 'fail')
  return Response.json({ ok, checks })
}
