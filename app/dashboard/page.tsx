import Link from 'next/link'

import { Dashboard } from '@/components/dashboard'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Dashboard | LinearVoice',
  description: 'Dashboard de eventos y estado de LinearVoice',
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-950 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_45%)] py-8">
      <div className="mx-auto mb-4 flex w-full max-w-6xl items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
        <Button asChild variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800">
          <Link href="/">Volver a landing</Link>
        </Button>
      </div>

      <Dashboard />
    </main>
  )
}
