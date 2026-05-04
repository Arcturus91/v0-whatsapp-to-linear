// TODO: PM — conversation detail view; consume GET /api/conversations/:id
export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main className="p-8 text-zinc-300">
      <h1 className="text-xl font-semibold mb-2">Conversation {id}</h1>
      <p className="text-sm text-zinc-500">PM scope. Pending implementation.</p>
    </main>
  )
}
