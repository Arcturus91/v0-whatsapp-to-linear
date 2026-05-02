import { latestId, readSince } from '@/lib/events/read'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 1_000
const HEARTBEAT_MS = 15_000

/**
 * Server-Sent Events feed of the demo Redis Stream.
 *
 * Upstash REST Redis does not support BLOCK on XREAD, so we poll
 * `xrange` from the last seen id every second and push deltas to
 * the client. A heartbeat keeps the connection alive through any
 * proxies that drop idle streams.
 */
export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder()
  const initialId = await latestId().catch(() => '0')

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const onAbort = () => {
        closed = true
      }
      req.signal.addEventListener('abort', onAbort)

      controller.enqueue(
        encoder.encode(`event: ready\ndata: ${JSON.stringify({ initialId })}\n\n`),
      )

      let lastId = initialId
      let lastHeartbeat = Date.now()

      while (!closed) {
        try {
          const events = await readSince(lastId, 100)
          for (const ev of events) {
            lastId = ev.id
            controller.enqueue(
              encoder.encode(`id: ${ev.id}\ndata: ${JSON.stringify(ev)}\n\n`),
            )
          }
          if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
            lastHeartbeat = Date.now()
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
          )
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
