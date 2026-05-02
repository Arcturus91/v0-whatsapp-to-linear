'use client'

import { DashboardEvent } from './types'

type MessagesFeedProps = {
  events: DashboardEvent[]
  selectedEventId: string | null
  onSelectEvent: (eventId: string) => void
  loading: boolean
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

export function MessagesFeed({
  events,
  selectedEventId,
  onSelectEvent,
  loading,
}: MessagesFeedProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">Mensajes recientes</h2>
        <span className="text-xs text-zinc-400">{events.length} eventos</span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Cargando eventos...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay mensajes todavia.</p>
      ) : (
        <ul className="space-y-3">
          {events.map(event => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelectEvent(event.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selectedEventId === event.id
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-zinc-400">
                    {event.type.replace('.', ' ')}
                  </span>
                  <span className="text-xs text-zinc-500">{formatTimestamp(event.timestamp)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-zinc-200">{event.content}</p>
                <p className="mt-2 text-xs text-zinc-500">Autor: {event.author}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
