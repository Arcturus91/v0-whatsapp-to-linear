'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type HealthResponse = {
  ok: boolean
  checks: Record<string, string>
}

export default function Home() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: HealthResponse) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <Card className="w-[440px] bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>LinearVoice — Backend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? (
            <div className="text-red-400 text-sm">Error: {error}</div>
          ) : data ? (
            <>
              <div className="flex justify-between text-sm border-b border-zinc-800 pb-2">
                <span className="font-mono text-zinc-300">overall</span>
                <span className={data.ok ? 'text-emerald-400' : 'text-red-400'}>
                  {data.ok ? 'ok' : 'fail'}
                </span>
              </div>
              {Object.entries(data.checks).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="font-mono text-zinc-400">{k}</span>
                  <span className={v === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{v}</span>
                </div>
              ))}
            </>
          ) : (
            <div className="text-zinc-400 text-sm">Checking…</div>
          )}
          <div className="pt-3 text-xs text-zinc-500">
            Dashboard at <code className="font-mono text-zinc-400">/dashboard</code> (PM scope).
          </div>
          <div className="pt-1 text-xs text-zinc-500">
            Webhook: <code className="font-mono text-zinc-400">/api/whatsapp</code>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
