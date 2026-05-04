import { getEnv } from '@/lib/env'

/**
 * Tiny authenticated fetch helper for the Kapso REST API.
 * Throws on non-2xx so callers can log meaningful errors.
 */
export async function kapsoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const env = getEnv()
  const url = path.startsWith('http')
    ? path
    : `${env.KAPSO_API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${env.KAPSO_API_KEY}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    throw new Error(`Kapso ${res.status} ${path}: ${await res.text().catch(() => res.statusText)}`)
  }
  return res
}
