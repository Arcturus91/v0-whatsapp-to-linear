'use client'

type ChecklistItem = {
  key: string
  label: string
  passed: boolean
  blocking?: boolean
}

type QualityChecklistProps = {
  checklist: ChecklistItem[]
}

export function QualityChecklist({ checklist }: QualityChecklistProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="mb-3 text-base font-semibold text-zinc-100">Checklist previa</h2>
      <ul className="space-y-2">
        {checklist.map(item => (
          <li
            key={item.key}
            className={`rounded-md border px-3 py-2 text-sm ${
              item.passed
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : item.blocking
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            }`}
          >
            {item.passed ? 'OK' : item.blocking ? 'Falta' : 'Recomendado'}: {item.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
