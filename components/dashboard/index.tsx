'use client'

import { useEffect, useMemo, useState } from 'react'

import { IssuePreview } from './issue-preview'
import { IssueStructurerForm } from './issue-structurer-form'
import { MessagesFeed } from './messages-feed'
import { QualityChecklist } from './quality-checklist'
import { DashboardEvent, DashboardMetrics, IssueDraft } from './types'

const INITIAL_DRAFT: IssueDraft = {
  title: '',
  context: '',
  tasks: '',
  acceptanceCriteria: '',
  references: '',
  team: '',
  priority: '3',
  project: 'HACKathon',
  labels: '',
  assignee: '',
  dueDate: '',
  blockedBy: '',
  blocks: '',
  estimatedDays: '',
  duplicateCheck: '',
}

type MetricsResponse = DashboardMetrics
type EventsResponse = {
  total: number
  events: Array<{
    type: DashboardEvent['type']
    timestamp: number
    payload: Record<string, unknown>
  }>
}

function normalizeEvent(payloadEvent: EventsResponse['events'][number], index: number): DashboardEvent {
  const payload = payloadEvent.payload
  const whatsappText = typeof payload.text === 'string' ? payload.text : ''
  const botText = typeof payload.content === 'string' ? payload.content : ''
  const content = whatsappText || botText || '(sin texto)'
  const author =
    (typeof payload.from === 'string' && payload.from) ||
    (typeof payload.userId === 'string' && payload.userId) ||
    'desconocido'
  const conversationId =
    (typeof payload.id === 'string' && payload.id) ||
    (typeof payload.conversationId === 'string' && payload.conversationId) ||
    `event-${payloadEvent.timestamp}-${index}`

  return {
    id: `${payloadEvent.timestamp}-${index}`,
    type: payloadEvent.type,
    timestamp: payloadEvent.timestamp,
    conversationId,
    author,
    content,
    rawPayload: payload,
  }
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function buildIssuePreview(draft: IssueDraft): string {
  const tasks = splitLines(draft.tasks)
  const references = splitLines(draft.references)
  const labels = splitLines(draft.labels.replaceAll(',', '\n'))

  return [
    `Titulo: ${draft.title || '(pendiente)'}`,
    '',
    'Descripcion:',
    `Contexto: ${draft.context || '(pendiente)'}`,
    '',
    'Que hacer:',
    tasks.length > 0 ? tasks.map(task => `- [ ] ${task}`).join('\n') : '- [ ] (pendiente)',
    '',
    `Criterio de aceptacion: ${draft.acceptanceCriteria || '(pendiente)'}`,
    '',
    'Referencias:',
    references.length > 0 ? references.map(reference => `- ${reference}`).join('\n') : '- (pendiente)',
    '',
    `Team: ${draft.team || '(pendiente)'}`,
    `Prioridad: ${draft.priority}`,
    `Proyecto: ${draft.project || '(sin proyecto)'}`,
    `Etiquetas: ${labels.length > 0 ? labels.join(', ') : '(sin etiquetas)'}`,
    `Asignado: ${draft.assignee || '(sin asignar)'}`,
    `Due date: ${draft.dueDate || '(sin fecha)'}`,
    `blockedBy: ${draft.blockedBy || '(ninguno)'}`,
    `blocks: ${draft.blocks || '(ninguno)'}`,
  ].join('\n')
}

export function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<IssueDraft>(INITIAL_DRAFT)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [metricsRes, eventsRes] = await Promise.all([
          fetch('/api/metrics'),
          fetch('/api/events?types=whatsapp.message,bot.response&limit=100'),
        ])

        if (metricsRes.ok) {
          const data: MetricsResponse = await metricsRes.json()
          setMetrics(data)
        }

        if (eventsRes.ok) {
          const data: EventsResponse = await eventsRes.json()
          const normalized = data.events.map(normalizeEvent)
          setEvents(normalized)
          setSelectedEventId(current => current ?? normalized[0]?.id ?? null)
        }
      } catch (error) {
        console.error('[v0] Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
    const interval = setInterval(loadDashboardData, 7000)
    return () => clearInterval(interval)
  }, [])

  const selectedEvent = useMemo(
    () => events.find(event => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  )

  useEffect(() => {
    if (!selectedEvent) return

    setDraft(current => {
      if (current.context || current.tasks || current.title) return current

      return {
        ...current,
        title: 'Implementar tarea solicitada por WhatsApp',
        context: `Solicitud recibida desde WhatsApp: "${selectedEvent.content}"`,
        tasks: `Analizar requerimiento: ${selectedEvent.content}\nDefinir implementacion tecnica\nEjecutar cambios y validar`,
        references: `Evento ${selectedEvent.id}`,
      }
    })
  }, [selectedEvent])

  const checklist = useMemo(() => {
    const tasks = splitLines(draft.tasks)
    const references = splitLines(draft.references)
    const labels = splitLines(draft.labels.replaceAll(',', '\n'))
    const estimatedDays = Number.parseFloat(draft.estimatedDays || '0')
    const hasOwnerOrDecision = Boolean(draft.assignee) || labels.includes('needs-decision')

    return [
      {
        key: 'atomic',
        label: 'Es atomica (una tarea deberia mapear a un PR).',
        passed: tasks.length > 0 && tasks.length <= 6,
        blocking: false,
      },
      {
        key: 'verifiable',
        label: 'Es verificable con criterio de aceptacion claro.',
        passed: draft.acceptanceCriteria.trim().length >= 20,
        blocking: true,
      },
      {
        key: 'dependencies',
        label: 'Dependencias declaradas (blockedBy o blocks, o explicito ninguno).',
        passed: Boolean(draft.blockedBy || draft.blocks || draft.references.includes('ninguno')),
        blocking: false,
      },
      {
        key: 'owner',
        label: 'Tiene owner o etiqueta needs-decision.',
        passed: hasOwnerOrDecision,
        blocking: false,
      },
      {
        key: 'effort',
        label: 'Esfuerzo menor o igual a 1 dia para evitar tareas gigantes.',
        passed: Boolean(draft.estimatedDays) && estimatedDays <= 1,
        blocking: false,
      },
      {
        key: 'duplicate',
        label: 'Chequeo de duplicados completado.',
        passed: draft.duplicateCheck.trim().length > 0,
        blocking: true,
      },
      {
        key: 'context',
        label: 'Tiene contexto suficiente para que otro dev la tome.',
        passed: draft.context.trim().length > 20 && tasks.length > 0 && references.length > 0,
        blocking: true,
      },
    ]
  }, [draft])

  const requiredChecks = useMemo(() => {
    const tasks = splitLines(draft.tasks)
    return {
      title: draft.title.trim().length > 0 && draft.title.trim().length < 80,
      context: draft.context.trim().length > 0,
      tasks: tasks.length > 0,
      acceptance: draft.acceptanceCriteria.trim().length > 0,
      references: draft.references.trim().length > 0,
      team: draft.team.trim().length > 0,
      priority: Boolean(draft.priority),
    }
  }, [draft])

  const canFinalize =
    Object.values(requiredChecks).every(Boolean) &&
    checklist.filter(item => item.blocking).every(item => item.passed)

  const preview = useMemo(() => buildIssuePreview(draft), [draft])

  const metricRows =
    metrics && metrics.eventTypes && typeof metrics.eventTypes === 'object'
      ? Object.entries(metrics.eventTypes).map(([name, value]) => ({ name, value }))
      : []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm uppercase tracking-wide text-zinc-400">Total events</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-100">{loading ? '—' : metrics?.totalEvents ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="mb-2 text-sm uppercase tracking-wide text-zinc-400">Tipos de eventos</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {metricRows.length > 0 ? (
              metricRows.map(metric => (
                <li key={metric.name} className="flex items-center justify-between">
                  <span>{metric.name}</span>
                  <span>{metric.value}</span>
                </li>
              ))
            ) : (
              <li className="text-zinc-500">Sin datos</li>
            )}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <MessagesFeed
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          loading={loading}
        />

        <div className="space-y-6">
          <IssueStructurerForm draft={draft} onDraftChange={setDraft} />
          <QualityChecklist checklist={checklist} />
          <IssuePreview preview={preview} canFinalize={canFinalize} />
        </div>
      </section>
    </div>
  )
}
