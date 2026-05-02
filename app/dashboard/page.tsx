// TODO: PM — see ARCHITECTURE.md §Frontend (live feed, 3-panel layout)
// Endpoints available:
//   GET  /api/events            (SSE stream of DemoEvent)
//   GET  /api/conversations     (list)
//   GET  /api/conversations/:id (detail)
//   GET  /api/issues
//   GET  /api/metrics
export default function DashboardPage() {
  return (
    <main className="p-8 text-zinc-300">
      <h1 className="text-xl font-semibold mb-2">LinearVoice — Dashboard</h1>
      <p className="text-sm text-zinc-500">PM scope. Pending implementation.</p>
    </main>
  )
}
