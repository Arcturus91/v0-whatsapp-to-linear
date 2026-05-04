import { Sparkles } from 'lucide-react'

export function LandingHero() {
  return (
    <header className="animate-in fade-in slide-in-from-bottom-2 text-center duration-700">
      <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-300">
        <Sparkles className="size-3" aria-hidden="true" />
        Vercel Hackathon · Track 3 · Chat SDK Agents
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
        LinearVoice
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-300 sm:text-xl">
        Convertí una nota de voz por WhatsApp en un issue de Linear estructurado.
        Sin abrir la app. Sin escribir un texto perfecto.
      </p>
      <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500">
        El bot recuerda la conversación, te pide lo que falta, y crea el ticket
        con summary, objective, testing y acceptance criteria.
      </p>
    </header>
  )
}
