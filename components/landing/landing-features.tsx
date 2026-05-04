import { Mic, MessageSquareText, ListChecks } from 'lucide-react'

const features = [
  {
    title: 'Voz o texto',
    description:
      'Mandá una nota de voz mientras manejás. La transcribimos con ElevenLabs y la convertimos en acción.',
    icon: Mic,
  },
  {
    title: 'Conversación con memoria',
    description:
      'El bot recuerda los últimos turnos. Si te falta info, te pregunta — un campo a la vez, sin volver a empezar.',
    icon: MessageSquareText,
  },
  {
    title: 'Issues estructurados',
    description:
      'Cada ticket sale con summary, objective, testing y acceptance criteria. Listo para que el equipo lo trabaje.',
    icon: ListChecks,
  },
]

export function LandingFeatures() {
  return (
    <section
      aria-label="Features"
      className="animate-in fade-in slide-in-from-bottom-2 delay-150 duration-700"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <li
              key={feature.title}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-zinc-900/80"
            >
              <div className="mb-3 inline-flex rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-500/20">
                <Icon className="size-4 text-emerald-400" aria-hidden="true" />
              </div>
              <p className="text-base font-semibold text-zinc-100">{feature.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
