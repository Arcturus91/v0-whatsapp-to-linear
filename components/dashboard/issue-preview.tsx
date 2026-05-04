'use client'

import { Button } from '@/components/ui/button'

type IssuePreviewProps = {
  preview: string
  canFinalize: boolean
}

export function IssuePreview({ preview, canFinalize }: IssuePreviewProps) {
  async function copyToClipboard() {
    await navigator.clipboard.writeText(preview)
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">Preview del issue</h2>
        <Button
          type="button"
          onClick={copyToClipboard}
          variant="outline"
          className="border-zinc-700 bg-zinc-950 text-zinc-100 hover:bg-zinc-800"
        >
          Copiar borrador
        </Button>
      </div>

      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
        {preview}
      </pre>

      <p className={`mt-3 text-sm ${canFinalize ? 'text-emerald-300' : 'text-amber-300'}`}>
        {canFinalize
          ? 'Listo para crear issue en Linear.'
          : 'Completa los campos obligatorios para habilitar la creacion.'}
      </p>
    </section>
  )
}
