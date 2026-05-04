'use client'

import { ChangeEvent } from 'react'

import { IssueDraft } from './types'

type IssueStructurerFormProps = {
  draft: IssueDraft
  onDraftChange: (nextDraft: IssueDraft) => void
}

function updateField<K extends keyof IssueDraft>(
  draft: IssueDraft,
  onDraftChange: (nextDraft: IssueDraft) => void,
  key: K
) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onDraftChange({
      ...draft,
      [key]: event.target.value,
    })
  }
}

export function IssueStructurerForm({ draft, onDraftChange }: IssueStructurerFormProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <h2 className="mb-4 text-base font-semibold text-zinc-100">Estructurador de issue</h2>

      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Titulo (obligatorio)</span>
          <input
            value={draft.title}
            onChange={updateField(draft, onDraftChange, 'title')}
            placeholder="Implementar webhook de WhatsApp"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Contexto (obligatorio)</span>
          <textarea
            value={draft.context}
            onChange={updateField(draft, onDraftChange, 'context')}
            rows={3}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            placeholder="Por que existe esta tarea."
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Que hacer (obligatorio, una linea por subtarea)</span>
          <textarea
            value={draft.tasks}
            onChange={updateField(draft, onDraftChange, 'tasks')}
            rows={4}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            placeholder="Validar webhook en staging"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Criterio de aceptacion (obligatorio)</span>
          <textarea
            value={draft.acceptanceCriteria}
            onChange={updateField(draft, onDraftChange, 'acceptanceCriteria')}
            rows={3}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-300">Referencias (obligatorio)</span>
          <textarea
            value={draft.references}
            onChange={updateField(draft, onDraftChange, 'references')}
            rows={2}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Team (obligatorio)</span>
            <input
              value={draft.team}
              onChange={updateField(draft, onDraftChange, 'team')}
              placeholder="Engineering"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Prioridad (obligatorio)</span>
            <select
              value={draft.priority}
              onChange={updateField(draft, onDraftChange, 'priority')}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            >
              <option value="1">Urgent (1)</option>
              <option value="2">High (2)</option>
              <option value="3">Medium (3)</option>
              <option value="4">Low (4)</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Proyecto</span>
            <input
              value={draft.project}
              onChange={updateField(draft, onDraftChange, 'project')}
              placeholder="HACKathon"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Etiquetas (coma separada)</span>
            <input
              value={draft.labels}
              onChange={updateField(draft, onDraftChange, 'labels')}
              placeholder="Front, Feature, Fase 1"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Asignado</span>
            <input
              value={draft.assignee}
              onChange={updateField(draft, onDraftChange, 'assignee')}
              placeholder="@usuario"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Due date</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={updateField(draft, onDraftChange, 'dueDate')}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">blockedBy</span>
            <input
              value={draft.blockedBy}
              onChange={updateField(draft, onDraftChange, 'blockedBy')}
              placeholder="CLO-100"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">blocks</span>
            <input
              value={draft.blocks}
              onChange={updateField(draft, onDraftChange, 'blocks')}
              placeholder="CLO-101"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Esfuerzo estimado (dias)</span>
            <input
              type="number"
              min="0"
              value={draft.estimatedDays}
              onChange={updateField(draft, onDraftChange, 'estimatedDays')}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-300">Chequeo de duplicados</span>
            <input
              value={draft.duplicateCheck}
              onChange={updateField(draft, onDraftChange, 'duplicateCheck')}
              placeholder="No hay issues similares abiertos"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
            />
          </label>
        </div>
      </div>
    </section>
  )
}
