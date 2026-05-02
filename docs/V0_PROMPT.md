# v0 Prompt — LinearVoice Backend

> Copy everything below the `---` line into v0 as a single prompt.

---

## Mission

Build the **backend** of a WhatsApp-to-Linear AI agent called **LinearVoice**. A user sends a WhatsApp message (text or voice note) and the bot creates, reads, or updates Linear issues using natural language. The bot replies with text and optionally a voice note.

**Important:** A separate engineer is building the dashboard UI. You should build:
- The full backend (webhook, AI agent, integrations)
- A minimal home page (`app/page.tsx`) that just shows project status (a single status card)
- Stub the dashboard pages with `// TODO: PM` comments — do NOT design or implement the dashboard UI

This is a Next.js 16 App Router project deployed to Vercel.

---

## Tech Stack (exact)

- **Next.js** 16 App Router (latest)
- **TypeScript** strict mode
- **Tailwind CSS** v4 + **shadcn/ui** (only for the home status card)
- **Runtime:** Node.js (Vercel Fluid Compute) — NOT edge
- **Vercel Chat SDK:** package name is literally `chat` (yes, just `chat`). Adapter: `@chat-adapter/whatsapp`. State: `@chat-adapter/state-redis`.
- **AI SDK v6:** package `ai` (v6.x). Use `ToolLoopAgent`. Route models through Vercel AI Gateway with plain `"provider/model"` strings — do NOT install `@ai-sdk/anthropic` or any provider package.
- **Default model:** `anthropic/claude-sonnet-4.6`. Failover model: `openai/gpt-5.4`.
- **MCP client:** AI SDK has built-in MCP support via `experimental_createMCPClient`. Use it to connect to Linear's official MCP server at `https://mcp.linear.app/sse`.
- **WhatsApp surface:** **Kapso** (https://kapso.ai) — a WhatsApp Cloud API proxy. Use the Kapso sandbox for the demo. The `@chat-adapter/whatsapp` adapter speaks Meta Cloud API; we will point its `apiBase` (or equivalent) at Kapso's endpoint. If the adapter does not accept a custom base URL, write a thin wrapper at `lib/kapso-webhook-adapter.ts` that translates Kapso webhook payloads to the shape the Chat SDK adapter expects.
- **Voice:** **ElevenLabs** — STT for inbound voice notes, TTS for outbound replies. Package: `elevenlabs` (official SDK).
- **Storage:** **Upstash Redis** (Vercel Marketplace integration). Auto-provisioned env vars `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Use `@upstash/redis` for raw Redis access (events stream, conversation hashes). The Chat SDK state adapter uses its own connection.
- **Realtime to dashboard:** Server-Sent Events (SSE) on `/api/events`.

**Do NOT install:** any provider-specific AI SDK package (e.g. `@ai-sdk/openai`, `@ai-sdk/anthropic`), Postgres, Prisma, Drizzle, NextAuth, Edge runtime libraries.

---

## Critical Library Notes

### Chat SDK (`chat` package)
- Initialize with `new Chat({ userName, adapters, state, dedupeTtlMs })`
- Each registered adapter exposes `bot.webhooks.<name>` — wire it to your route handler.
- Handlers used in this project: `onDirectMessage(thread, message)`. Do NOT use `onNewMention` — WhatsApp does not have @-mentions for our flow.
- `thread.post()` accepts strings, JSX cards, **or** `AsyncIterable<string>` (which is what AI SDK's stream returns). Pass the agent stream directly for live "typing" effect.
- Call `await thread.subscribe()` inside handlers if you want subsequent messages in the same thread to also fire `onSubscribedMessage` — for our 1:1 DM flow on WhatsApp this is automatic so we don't need it.
- For state in dev/local, you may also use `@chat-adapter/state-memory` as a fallback if Redis env is missing (gate with an `if`).

### AI SDK v6 (`ai`)
- Use `ToolLoopAgent` (not `generateText` directly). Example:
  ```ts
  import { ToolLoopAgent } from 'ai'

  const agent = new ToolLoopAgent({
    model: 'anthropic/claude-sonnet-4.6',
    system: '...prompt...',
    tools: { /* MCP tools merged in */ },
    stopWhen: ({ steps }) => steps.length > 8,
  })
  const result = await agent.stream({ prompt: userText })
  await thread.post(result.fullStream) // pass fullStream, not textStream
  ```
- AI Gateway is invoked simply by passing `"provider/model"` as a string. No wrapper needed unless we want fallback options:
  ```ts
  import { gateway } from 'ai'
  model: gateway('anthropic/claude-sonnet-4.6')
  providerOptions: {
    gateway: {
      models: ['openai/gpt-5.4'],
      tags: ['env:production', 'feature:linearvoice'],
    },
  }
  ```

### MCP integration (Linear)
```ts
import { experimental_createMCPClient as createMCPClient } from 'ai'

const linear = await createMCPClient({
  transport: { type: 'sse', url: 'https://mcp.linear.app/sse' },
})
const linearTools = await linear.tools()
// Pass linearTools into ToolLoopAgent({ tools: { ...linearTools } })
```
The Linear MCP server uses OAuth — first run will redirect to authorize. For hackathon, support a static `LINEAR_OAUTH_TOKEN` env var as a fallback the MCP client can pass in headers.

### Kapso webhook payload
Inbound webhook is `POST` JSON. Key shape (simplified):
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "+5491133334444",
          "id": "wamid.HBgL...",
          "type": "text" | "audio",
          "text": { "body": "..." },
          "audio": { "id": "media-id", "mime_type": "audio/ogg" }
        }],
        "metadata": { "phone_number_id": "..." }
      }
    }]
  }]
}
```
For audio: fetch the media via `GET https://api.kapso.ai/v1/media/{id}` with `Authorization: Bearer ${KAPSO_API_KEY}`.

### ElevenLabs voice
- STT: `client.speechToText.convert({ file, modelId: 'scribe_v1' })` returns `{ text }`
- TTS: `client.textToSpeech.convert(voiceId, { text, modelId: 'eleven_turbo_v2_5' })` returns audio stream — collect into Buffer.
- For TTS reply, upload to Kapso media (`POST /v1/media`) then send as audio message via the Chat SDK adapter (or directly through Kapso SDK if needed).

---

## File Structure

```
.
├── app/
│   ├── api/
│   │   ├── whatsapp/route.ts          # Kapso webhook → Chat SDK
│   │   ├── events/route.ts            # SSE stream for dashboard
│   │   ├── conversations/
│   │   │   ├── route.ts               # GET list
│   │   │   └── [id]/route.ts          # GET detail
│   │   ├── metrics/route.ts           # GET aggregated counters
│   │   ├── issues/route.ts            # GET issues touched in demo
│   │   ├── test/send/route.ts         # POST manual test message
│   │   └── health/route.ts            # GET status of all integrations
│   ├── dashboard/
│   │   ├── page.tsx                   # // TODO: PM
│   │   ├── conversations/[id]/page.tsx # // TODO: PM
│   │   └── metrics/page.tsx           # // TODO: PM
│   ├── page.tsx                       # Minimal landing with status card
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── chat/
│   │   ├── bot.ts                     # Singleton Chat instance + handlers
│   │   ├── handlers.ts                # onDirectMessage logic
│   │   └── system-prompt.ts           # Agent instructions
│   ├── ai/
│   │   ├── agent.ts                   # ToolLoopAgent factory
│   │   └── mcp.ts                     # Linear MCP client + tool aggregation
│   ├── voice/
│   │   ├── stt.ts                     # ElevenLabs STT wrapper
│   │   └── tts.ts                     # ElevenLabs TTS wrapper
│   ├── kapso/
│   │   ├── client.ts                  # HTTP client for Kapso API
│   │   ├── media.ts                   # Download/upload media
│   │   └── webhook-adapter.ts         # Translate Kapso payload ↔ Chat SDK shape
│   ├── events/
│   │   ├── emit.ts                    # XADD to events:stream
│   │   ├── read.ts                    # XREAD for SSE
│   │   └── types.ts                   # EventType union, payloads
│   ├── redis/
│   │   └── client.ts                  # Upstash Redis singleton
│   └── env.ts                         # Type-safe env vars (zod)
├── components/
│   └── ui/                            # shadcn primitives (Card only for now)
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Implementation Detail (file by file)

### `lib/env.ts`
Validate env at boot with zod. Required keys:
```ts
import { z } from 'zod'

const schema = z.object({
  // Vercel-managed
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  // AI
  AI_GATEWAY_API_KEY: z.string().optional(), // optional if VERCEL_OIDC_TOKEN present
  VERCEL_OIDC_TOKEN: z.string().optional(),
  // Kapso
  KAPSO_API_KEY: z.string(),
  KAPSO_API_BASE: z.string().url().default('https://api.kapso.ai'),
  KAPSO_WEBHOOK_SECRET: z.string(),
  KAPSO_PHONE_NUMBER_ID: z.string(),
  // Linear
  LINEAR_OAUTH_TOKEN: z.string(),
  // ElevenLabs
  ELEVENLABS_API_KEY: z.string(),
  ELEVENLABS_VOICE_ID: z.string().default('JBFqnCBsd6RMkjVDRZzb'),
  // Bot config
  BOT_USERNAME: z.string().default('linearvoice'),
})

export const env = schema.parse(process.env)
```

### `lib/redis/client.ts`
```ts
import { Redis } from '@upstash/redis'
import { env } from '@/lib/env'
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})
```

### `lib/events/types.ts`
```ts
export type DemoEvent =
  | { type: 'message_received'; conversationId: string; from: string; content: string; modality: 'text' | 'audio'; ts: number }
  | { type: 'tool_call_started'; conversationId: string; toolCallId: string; tool: string; input: unknown; ts: number }
  | { type: 'tool_call_finished'; conversationId: string; toolCallId: string; output: unknown; latencyMs: number; ts: number }
  | { type: 'message_sent'; conversationId: string; content: string; modality: 'text' | 'audio'; tokensIn?: number; tokensOut?: number; costUsd?: number; ts: number }
  | { type: 'error'; conversationId?: string; error: string; ts: number }
```

### `lib/events/emit.ts`
```ts
import { redis } from '@/lib/redis/client'
import type { DemoEvent } from './types'

export async function emit(event: DemoEvent) {
  // XADD events:stream * type message_received conversationId ... ts ...
  // Upstash supports XADD via redis.xadd
  await redis.xadd('events:stream', '*', { ...event, payload: JSON.stringify(event) })
  // Maintain conversation list
  if ('conversationId' in event && event.conversationId) {
    await redis.zadd('conversations:active', { score: event.ts, member: event.conversationId })
    await redis.rpush(`conversation:${event.conversationId}:messages`, JSON.stringify(event))
    await redis.expire(`conversation:${event.conversationId}:messages`, 86400)
  }
  // TTL on stream key
  await redis.expire('events:stream', 86400)
}
```

### `lib/events/read.ts`
Read from Redis Stream after a `lastId` (default `$` for tail). Returns parsed events. Used by SSE handler.
```ts
import { redis } from '@/lib/redis/client'
export async function readSince(lastId: string = '$', blockMs = 25_000) {
  const res = await redis.xread([{ key: 'events:stream', id: lastId }], { block: blockMs, count: 50 })
  return res?.flatMap(s => s.messages.map(m => ({ id: m.id, ...JSON.parse(m.payload) }))) ?? []
}
```

### `lib/kapso/client.ts`
Thin fetch wrapper:
```ts
import { env } from '@/lib/env'
export async function kapsoFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${env.KAPSO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.KAPSO_API_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`Kapso ${res.status}: ${await res.text()}`)
  return res
}
```

### `lib/kapso/media.ts`
```ts
import { kapsoFetch } from './client'

export async function downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const meta = await kapsoFetch(`/v1/media/${mediaId}`).then(r => r.json())
  const file = await kapsoFetch(meta.url).then(r => r.arrayBuffer())
  return { buffer: Buffer.from(file), mimeType: meta.mime_type }
}

export async function uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimeType }))
  form.append('messaging_product', 'whatsapp')
  const res = await kapsoFetch('/v1/media', { method: 'POST', body: form, headers: {} })
  const json = await res.json()
  return json.id
}
```

### `lib/kapso/webhook-adapter.ts`
This is the **risk point**. First, check if `@chat-adapter/whatsapp` accepts a `apiBase` config.
```ts
import { createWhatsAppAdapter } from '@chat-adapter/whatsapp'
import { env } from '@/lib/env'

// Try this first; if the adapter type doesn't accept apiBase/baseUrl, fall back to the manual translator below
export const whatsappAdapter = createWhatsAppAdapter({
  apiBase: env.KAPSO_API_BASE,        // try this
  accessToken: env.KAPSO_API_KEY,
  phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
  webhookSecret: env.KAPSO_WEBHOOK_SECRET,
})
```
If `apiBase` is not a valid option per the adapter's TypeScript signature, build a minimal adapter that mirrors the same interface using `@chat-adapter/shared`'s `BaseFormatConverter` and the Kapso SDK directly. Keep this fallback under 80 lines.

### `lib/chat/system-prompt.ts`
```ts
export const SYSTEM_PROMPT = `You are LinearVoice, an assistant inside WhatsApp that helps the user manage Linear issues.

You can:
- create_issue: create a new issue (gather title, description, team, priority, due date)
- list_issues: list issues by team, status, assignee, due date
- update_issue: update title, description, status, priority, assignee
- search_issues: full-text search

Rules:
- Always confirm destructive actions (close, delete) before executing.
- When the user is vague ("create a ticket"), ask one short clarifying question.
- Keep replies short — this is a chat, not a doc. 1-3 sentences max.
- When you create an issue, reply with: identifier, title, link.
- If the user wrote in Spanish, reply in Spanish.
- Never expose tool errors verbatim. Translate them to friendly messages.`
```

### `lib/ai/mcp.ts`
```ts
import { experimental_createMCPClient as createMCPClient } from 'ai'
import { env } from '@/lib/env'

let cached: Awaited<ReturnType<typeof createMCPClient>> | null = null
export async function linearMCP() {
  if (cached) return cached
  cached = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'https://mcp.linear.app/sse',
      headers: { Authorization: `Bearer ${env.LINEAR_OAUTH_TOKEN}` },
    },
  })
  return cached
}

export async function linearTools() {
  const client = await linearMCP()
  return client.tools()
}
```

### `lib/ai/agent.ts`
```ts
import { ToolLoopAgent, gateway } from 'ai'
import { linearTools } from './mcp'
import { SYSTEM_PROMPT } from '@/lib/chat/system-prompt'

export async function buildAgent() {
  const tools = await linearTools()
  return new ToolLoopAgent({
    model: gateway('anthropic/claude-sonnet-4.6'),
    system: SYSTEM_PROMPT,
    tools,
    stopWhen: ({ steps }) => steps.length > 8,
    providerOptions: {
      gateway: {
        models: ['openai/gpt-5.4'],
        tags: ['feature:linearvoice', 'env:hackathon'],
      },
    },
  })
}
```

### `lib/voice/stt.ts`
```ts
import { ElevenLabsClient } from 'elevenlabs'
import { env } from '@/lib/env'

const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY })

export async function transcribe(buffer: Buffer, mimeType: string): Promise<string> {
  const file = new Blob([buffer], { type: mimeType })
  const res = await client.speechToText.convert({ file, modelId: 'scribe_v1' })
  return res.text
}
```

### `lib/voice/tts.ts`
```ts
import { ElevenLabsClient } from 'elevenlabs'
import { env } from '@/lib/env'

const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY })

export async function synthesize(text: string): Promise<Buffer> {
  const stream = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID, {
    text,
    modelId: 'eleven_turbo_v2_5',
    outputFormat: 'mp3_44100_128',
  })
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}
```

### `lib/chat/bot.ts`
```ts
import { Chat } from 'chat'
import { createRedisState } from '@chat-adapter/state-redis'
import { whatsappAdapter } from '@/lib/kapso/webhook-adapter'
import { env } from '@/lib/env'
import { registerHandlers } from './handlers'

let cached: Chat | null = null
export function getBot() {
  if (cached) return cached
  cached = new Chat({
    userName: env.BOT_USERNAME,
    adapters: { whatsapp: whatsappAdapter },
    state: createRedisState({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    dedupeTtlMs: 600_000,
  })
  registerHandlers(cached)
  return cached
}
```

### `lib/chat/handlers.ts`
This is the heart of the bot. Implements the audio-or-text flow with event emission.
```ts
import type { Chat, Thread, Message } from 'chat'
import { transcribe } from '@/lib/voice/stt'
import { synthesize } from '@/lib/voice/tts'
import { uploadMedia, downloadMedia } from '@/lib/kapso/media'
import { buildAgent } from '@/lib/ai/agent'
import { emit } from '@/lib/events/emit'

export function registerHandlers(bot: Chat) {
  bot.onDirectMessage(async (thread: Thread, message: Message) => {
    const conversationId = thread.id
    const ts = Date.now()
    let userText = message.text ?? ''
    let modality: 'text' | 'audio' = 'text'

    // 1. If audio, transcribe via ElevenLabs
    const audioAttachment = message.attachments?.find(a => a.kind === 'audio')
    if (audioAttachment) {
      modality = 'audio'
      const { buffer, mimeType } = await downloadMedia(audioAttachment.id)
      userText = await transcribe(buffer, mimeType)
    }

    await emit({ type: 'message_received', conversationId, from: message.author?.id ?? 'unknown', content: userText, modality, ts })

    // 2. Run agent
    const agent = await buildAgent()
    const result = await agent.stream({
      prompt: userText,
      onStepFinish: async (step) => {
        if (step.toolCalls?.length) {
          for (const call of step.toolCalls) {
            await emit({ type: 'tool_call_started', conversationId, toolCallId: call.toolCallId, tool: call.toolName, input: call.input, ts: Date.now() })
          }
        }
        if (step.toolResults?.length) {
          for (const r of step.toolResults) {
            await emit({ type: 'tool_call_finished', conversationId, toolCallId: r.toolCallId, output: r.output, latencyMs: 0, ts: Date.now() })
          }
        }
      },
    })

    // 3. Stream text reply
    await thread.post(result.fullStream)

    // 4. Collect final text for TTS + event log
    const finalText = await result.text
    await emit({ type: 'message_sent', conversationId, content: finalText, modality: 'text', ts: Date.now() })

    // 5. If user spoke, also send voice reply
    if (modality === 'audio' && finalText.length < 600) {
      try {
        const audio = await synthesize(finalText)
        const mediaId = await uploadMedia(audio, 'audio/mpeg')
        await thread.post({ kind: 'audio', mediaId } as any)
        await emit({ type: 'message_sent', conversationId, content: '[audio]', modality: 'audio', ts: Date.now() })
      } catch (e) {
        // TTS is optional; never block the reply
      }
    }
  })
}
```

### `app/api/whatsapp/route.ts`
```ts
import { getBot } from '@/lib/chat/bot'
import { emit } from '@/lib/events/emit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const bot = getBot()
    return await bot.webhooks.whatsapp(req)
  } catch (err) {
    await emit({ type: 'error', error: err instanceof Error ? err.message : String(err), ts: Date.now() })
    return new Response('error', { status: 500 })
  }
}

export async function GET(req: Request) {
  // Kapso webhook verification: echoes hub.challenge if mode=subscribe and token matches
  const url = new URL(req.url)
  if (url.searchParams.get('hub.verify_token') === process.env.KAPSO_WEBHOOK_SECRET) {
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('forbidden', { status: 403 })
}
```

### `app/api/events/route.ts`
SSE stream. Reads from Redis stream and pushes to client.
```ts
import { readSince } from '@/lib/events/read'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const encoder = new TextEncoder()
  let lastId = '$'
  let closed = false
  req.signal.addEventListener('abort', () => { closed = true })

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: {}\n\n`))
      while (!closed) {
        const events = await readSince(lastId, 25_000)
        for (const e of events) {
          lastId = e.id
          controller.enqueue(encoder.encode(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`))
        }
        // heartbeat
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

### `app/api/conversations/route.ts`
```ts
import { redis } from '@/lib/redis/client'
export const runtime = 'nodejs'

export async function GET() {
  const ids = await redis.zrange<string[]>('conversations:active', 0, -1, { rev: true })
  const items = await Promise.all(
    ids.map(async (id) => {
      const last = await redis.lrange<string>(`conversation:${id}:messages`, -1, -1)
      return { id, lastMessage: last[0] ? JSON.parse(last[0]) : null }
    })
  )
  return Response.json({ conversations: items })
}
```

### `app/api/conversations/[id]/route.ts`
```ts
import { redis } from '@/lib/redis/client'
export const runtime = 'nodejs'

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const raw = await redis.lrange<string>(`conversation:${id}:messages`, 0, -1)
  return Response.json({ id, events: raw.map(s => JSON.parse(s)) })
}
```

### `app/api/metrics/route.ts`
```ts
import { redis } from '@/lib/redis/client'
export const runtime = 'nodejs'

export async function GET() {
  const counters = await redis.hgetall('metrics:counters')
  const totalConversations = await redis.zcard('conversations:active')
  const issuesTouched = await redis.scard('issues:touched')
  return Response.json({ counters, totalConversations, issuesTouched })
}
```

### `app/api/issues/route.ts`
```ts
import { redis } from '@/lib/redis/client'
export const runtime = 'nodejs'

export async function GET() {
  const ids = await redis.smembers<string[]>('issues:touched')
  return Response.json({ issues: ids })
}
```

### `app/api/test/send/route.ts`
For QA — simulate an inbound text message without WhatsApp.
```ts
import { getBot } from '@/lib/chat/bot'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { from, text } = await req.json()
  const bot = getBot()
  // Construct a synthetic Kapso payload and feed it through the webhook
  const fakePayload = {
    entry: [{ changes: [{ value: { messages: [{ from, id: `test-${Date.now()}`, type: 'text', text: { body: text } }], metadata: { phone_number_id: 'test' } } }] }],
  }
  const fakeReq = new Request('http://local/api/whatsapp', { method: 'POST', body: JSON.stringify(fakePayload), headers: { 'content-type': 'application/json' } })
  return bot.webhooks.whatsapp(fakeReq)
}
```

### `app/api/health/route.ts`
```ts
import { redis } from '@/lib/redis/client'
import { env } from '@/lib/env'

export const runtime = 'nodejs'

export async function GET() {
  const checks: Record<string, 'ok' | 'fail'> = {}
  try { await redis.ping(); checks.redis = 'ok' } catch { checks.redis = 'fail' }
  checks.kapso = env.KAPSO_API_KEY ? 'ok' : 'fail'
  checks.linear = env.LINEAR_OAUTH_TOKEN ? 'ok' : 'fail'
  checks.elevenlabs = env.ELEVENLABS_API_KEY ? 'ok' : 'fail'
  checks.aiGateway = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN ? 'ok' : 'fail'
  return Response.json({ ok: Object.values(checks).every(v => v === 'ok'), checks })
}
```

### `app/page.tsx`
Tiny status page using shadcn `Card`. Pings `/api/health` once on mount and renders a checklist.
```tsx
'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const [data, setData] = useState<{ ok: boolean; checks: Record<string, string> } | null>(null)
  useEffect(() => { fetch('/api/health').then(r => r.json()).then(setData) }, [])
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <Card className="w-[420px] bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle>LinearVoice — Backend</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data ? Object.entries(data.checks).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="font-mono">{k}</span>
              <span className={v === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{v}</span>
            </div>
          )) : <div className="text-zinc-400 text-sm">Checking…</div>}
          <div className="pt-3 text-xs text-zinc-500">Dashboard at <code>/dashboard</code> (PM scope).</div>
        </CardContent>
      </Card>
    </main>
  )
}
```

### Stub dashboard pages
```tsx
// app/dashboard/page.tsx
export default function Dashboard() {
  return <main className="p-8 text-zinc-300">{/* TODO: PM — see ARCHITECTURE.md §Frontend */}</main>
}
// Same pattern for app/dashboard/conversations/[id]/page.tsx and app/dashboard/metrics/page.tsx
```

---

## Dependencies to install

```json
{
  "dependencies": {
    "next": "16",
    "react": "19",
    "react-dom": "19",
    "ai": "^6.0.0",
    "chat": "latest",
    "@chat-adapter/whatsapp": "latest",
    "@chat-adapter/state-redis": "latest",
    "@chat-adapter/state-memory": "latest",
    "@upstash/redis": "^1.34.0",
    "elevenlabs": "latest",
    "zod": "^3.23.0",
    "tailwindcss": "^4",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

Run `npx shadcn@latest init` and add only the `card` component.

---

## Env vars (`.env.example`)

```
# Vercel-managed (auto by Marketplace integrations)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
AI_GATEWAY_API_KEY=          # or use VERCEL_OIDC_TOKEN after `vercel link && vercel env pull`

# Kapso
KAPSO_API_KEY=
KAPSO_API_BASE=https://api.kapso.ai
KAPSO_WEBHOOK_SECRET=        # any random string; you set it in Kapso webhook config
KAPSO_PHONE_NUMBER_ID=       # from Kapso sandbox

# Linear
LINEAR_OAUTH_TOKEN=          # personal API key from linear.app/settings/api

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb

# Bot
BOT_USERNAME=linearvoice
```

---

## Out of scope (do NOT build)

- Dashboard UI (PM scope — leave stubs)
- User authentication (single-tenant demo)
- Multi-team Linear support (use first team returned by MCP)
- Templates / proactive messages (sandbox doesn't support them)
- Multi-language detection (model handles ES/EN naturally)
- Image/video attachments (text + audio only)
- AWS Lambda proactive worker (post-hackathon)

---

## Acceptance criteria (smoke test)

After running `pnpm dev`:

1. `GET http://localhost:3000/` → renders status card with all checks ✅
2. `GET http://localhost:3000/api/health` → returns `{ ok: true, checks: { redis: 'ok', kapso: 'ok', linear: 'ok', elevenlabs: 'ok', aiGateway: 'ok' } }`
3. `POST http://localhost:3000/api/test/send` with body `{ "from": "+5491133334444", "text": "hola, crea un ticket: arreglar login en mobile" }` → in dashboard SSE you should see: `message_received` → `tool_call_started` (linear.create_issue) → `tool_call_finished` → `message_sent`. The Linear workspace should have a new issue.
4. `GET /api/conversations` returns the conversation just created
5. Connecting to `/api/events` with `EventSource` streams events live
6. Deploy to Vercel succeeds with `vercel --prod`. `https://<deployment>.vercel.app/api/whatsapp` is the URL to paste into Kapso webhook config.

---

## Build steps for v0

1. Initialize Next.js 16 + TS + Tailwind + App Router
2. Install dependencies above (use pnpm)
3. Run `npx shadcn@latest init` and add `card`
4. Create all files listed in the file structure with the exact code shown
5. Create `.env.example` and a sibling `README.md` with this acceptance criteria checklist
6. Verify `pnpm tsc --noEmit` passes
7. Verify `pnpm build` succeeds
8. Output a final summary listing every file created and how to run the smoke test

When finished, **do not** create any dashboard UI beyond the stubs. Do not invent additional features. Match the file paths exactly so the PM's frontend can integrate cleanly.
