import { Mic, Globe2, Sparkles } from 'lucide-react'

const features = [
  {
    title: 'Voz',
    description: 'Envia y procesa notas de voz sin salir de WhatsApp.',
    icon: Mic,
  },
  {
    title: 'Multi-idioma',
    description: 'Entiende conversaciones en distintos idiomas de forma natural.',
    icon: Globe2,
  },
  {
    title: 'Multi-modelo',
    description: 'Orquesta modelos via AI Gateway para cada flujo.',
    icon: Sparkles,
  },
]

export function LandingFeatures() {
  return (
    <section
      aria-label="Features"
      className="animate-in fade-in slide-in-from-bottom-2 delay-150 duration-700"
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <li
              key={feature.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-emerald-500/40"
            >
              <Icon className="mb-2 size-4 text-emerald-400" aria-hidden="true" />
              <p className="text-sm font-medium text-zinc-100">{feature.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{feature.description}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
