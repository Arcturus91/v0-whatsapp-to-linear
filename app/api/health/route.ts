import { redis } from '@/lib/redis/client'
import { getEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'ok' | 'fail'

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
  checks.kapso = env.KAPSO_API_KEY ? 'ok' : 'fail'
  checks.linear = env.LINEAR_OAUTH_TOKEN ? 'ok' : 'fail'
  checks.elevenlabs = env.ELEVENLABS_API_KEY ? 'ok' : 'fail'
  checks.aiGateway = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN ? 'ok' : 'fail'

  const ok = Object.values(checks).every((v) => v === 'ok')
  return Response.json({ ok, checks })
}
