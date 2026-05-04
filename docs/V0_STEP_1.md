# v0 Prompt — Step 1: Foundation

> Paste this entire prompt into v0. Wait for v0 to finish. Do NOT proceed to Step 2 until I confirm.

---

## Context

You are building the backend of **LinearVoice**, a WhatsApp ↔ Linear AI agent for a Vercel hackathon. This is **Step 1 of 5**. Build ONLY what is described here. Do NOT build webhooks, AI agents, voice, or UI yet — those come in later steps.

**Stack constraints:**
- Next.js 16 App Router, TypeScript strict
- Tailwind v4 + shadcn/ui (will be initialized but used minimally)
- Node.js runtime (NOT edge) on Vercel Fluid Compute
- Package manager: `pnpm`

**Critical rules:**
- Do NOT install: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `prisma`, `drizzle`, `next-auth`, `postgres`, `@vercel/postgres`, `pg`, edge runtime libraries.
- Do NOT add features beyond what is listed below.
- Use exact file paths and exact code shown. No improvisation.

---

## Goal of Step 1

Build the foundation that every later step depends on:
1. Project scaffold (Next.js 16 + TS + Tailwind v4)
2. shadcn init with `card` component only
3. Type-safe env loader (`lib/env.ts`)
4. Upstash Redis client (`lib/redis/client.ts`)
5. Event types + emit/read helpers (`lib/events/*`)
6. `.env.example` and a barebones `app/page.tsx` placeholder
7. Verify everything compiles with `pnpm tsc --noEmit`

After Step 1, the project should build cleanly with zero TypeScript errors. There are NO API routes yet.

---

## Files to create

### 1. `package.json`

```json
{
  "name": "linearvoice",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@upstash/redis": "^1.34.3",
    "zod": "^3.23.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.468.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "eslint": "^9",
    "eslint-config-next": "^16.0.0"
  }
}
```

### 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3. `next.config.ts`

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
}

export default nextConfig
```

### 4. `postcss.config.mjs`

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

### 5. `app/globals.css`

```css
@import "tailwindcss";

@theme {
  --color-bg: #09090b;
  --color-fg: #fafafa;
  --color-muted: #71717a;
  --color-accent: #10b981;
  --color-danger: #ef4444;
}

html, body { background: var(--color-bg); color: var(--color-fg); }
```

### 6. `app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LinearVoice',
  description: 'WhatsApp ↔ Linear AI agent',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
```

### 7. `app/page.tsx` (temporary placeholder, will be replaced in Step 5)

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">LinearVoice</h1>
        <p className="text-zinc-400 text-sm mt-2">Backend bootstrapping… Step 1 of 5</p>
      </div>
    </main>
  )
}
```

### 8. `lib/env.ts`

Type-safe env loader. Validates ALL env vars LinearVoice will eventually need, but most are marked optional in Step 1 so the project boots without them set.

```ts
import { z } from 'zod'

const schema = z.object({
  // Upstash Redis (required even in Step 1 — events need it)
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // AI Gateway — one of these must be present (validated later, optional here)
  AI_GATEWAY_API_KEY: z.string().optional(),
  VERCEL_OIDC_TOKEN: z.string().optional(),

  // Kapso (optional in Step 1)
  KAPSO_API_KEY: z.string().optional(),
  KAPSO_API_BASE: z.string().url().default('https://api.kapso.ai'),
  KAPSO_WEBHOOK_SECRET: z.string().optional(),
  KAPSO_PHONE_NUMBER_ID: z.string().optional(),

  // Linear (optional in Step 1)
  LINEAR_OAUTH_TOKEN: z.string().optional(),

  // ElevenLabs (optional in Step 1)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('JBFqnCBsd6RMkjVDRZzb'),

  // Bot config
  BOT_USERNAME: z.string().default('linearvoice'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid env. See errors above. Required at minimum: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.')
}

export const env = parsed.data
export type Env = typeof env
```

### 9. `lib/redis/client.ts`

```ts
import { Redis } from '@upstash/redis'
import { env } from '@/lib/env'

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})
```

### 10. `lib/events/types.ts`

```ts
export type DemoEvent =
  | {
      type: 'message_received'
      conversationId: string
      from: string
      content: string
      modality: 'text' | 'audio'
      ts: number
    }
  | {
      type: 'tool_call_started'
      conversationId: string
      toolCallId: string
      tool: string
      input: unknown
      ts: number
    }
  | {
      type: 'tool_call_finished'
      conversationId: string
      toolCallId: string
      output: unknown
      latencyMs: number
      ts: number
    }
  | {
      type: 'message_sent'
      conversationId: string
      content: string
      modality: 'text' | 'audio'
      tokensIn?: number
      tokensOut?: number
      costUsd?: number
      ts: number
    }
  | {
      type: 'error'
      conversationId?: string
      error: string
      ts: number
    }

export type DemoEventType = DemoEvent['type']
```

### 11. `lib/events/emit.ts`

```ts
import { redis } from '@/lib/redis/client'
import type { DemoEvent } from './types'

const STREAM_KEY = 'events:stream'
const TTL_SECONDS = 86_400 // 24h

export async function emit(event: DemoEvent): Promise<void> {
  const payload = JSON.stringify(event)

  await redis.xadd(STREAM_KEY, '*', { payload })
  await redis.expire(STREAM_KEY, TTL_SECONDS)

  if ('conversationId' in event && event.conversationId) {
    const convId = event.conversationId
    await redis.zadd('conversations:active', { score: event.ts, member: convId })
    await redis.rpush(`conversation:${convId}:messages`, payload)
    await redis.expire(`conversation:${convId}:messages`, TTL_SECONDS)
    await redis.expire('conversations:active', TTL_SECONDS)
  }
}
```

### 12. `lib/events/read.ts`

```ts
import { redis } from '@/lib/redis/client'
import type { DemoEvent } from './types'

const STREAM_KEY = 'events:stream'

export type StreamEvent = DemoEvent & { id: string }

export async function readSince(lastId: string = '$', blockMs = 25_000): Promise<StreamEvent[]> {
  // @upstash/redis returns Record<streamKey, Record<id, fields>> for xread
  const result = (await redis.xread([{ key: STREAM_KEY, id: lastId }], {
    block: blockMs,
    count: 50,
  })) as Record<string, Record<string, { payload: string }>> | null

  if (!result) return []

  const messages = result[STREAM_KEY] ?? {}
  const events: StreamEvent[] = []
  for (const [id, fields] of Object.entries(messages)) {
    try {
      const parsed = JSON.parse(fields.payload) as DemoEvent
      events.push({ ...parsed, id })
    } catch {
      // skip malformed entries
    }
  }
  return events
}
```

### 13. `.env.example`

```
# === Required for Step 1 ===
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# === Required for Step 2 onwards ===
KAPSO_API_KEY=
KAPSO_API_BASE=https://api.kapso.ai
KAPSO_WEBHOOK_SECRET=
KAPSO_PHONE_NUMBER_ID=

# === Required for Step 3 (Linear MCP) ===
LINEAR_OAUTH_TOKEN=

# === Required for Step 3 (AI Gateway) ===
# Either set AI_GATEWAY_API_KEY OR rely on VERCEL_OIDC_TOKEN auto-pulled by `vercel env pull`
AI_GATEWAY_API_KEY=

# === Required for Step 4 (ElevenLabs voice) ===
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb

# === Optional ===
BOT_USERNAME=linearvoice
```

### 14. `.gitignore`

```
node_modules
.next
out
.env
.env*.local
*.log
.DS_Store
.vercel
```

### 15. `README.md`

```markdown
# LinearVoice

WhatsApp ↔ Linear AI agent. Hackathon Track 3 (Vercel Chat SDK).

## Status: bootstrapping

This is Step 1 of 5. The backend is being built incrementally:
1. ✅ Foundation (env, Redis client, event helpers)
2. ⬜ Webhook + stub echo bot
3. ⬜ AI agent with Linear MCP
4. ⬜ Voice (ElevenLabs STT + TTS)
5. ⬜ Read endpoints + status page

See `ARCHITECTURE.md` for full design.

## Run

```bash
pnpm install
cp .env.example .env.local
# Fill UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
pnpm typecheck
pnpm dev
```
```

---

## After all files are written

Run these commands and confirm each succeeds:

```bash
pnpm install
pnpm typecheck
```

`pnpm typecheck` MUST pass with zero errors. If it fails:
- Most likely cause: missing types from `@types/node` or `@types/react`. Re-check the deps in `package.json`.
- Do NOT add `// @ts-ignore` or `any` to silence errors. Fix the actual cause.

---

## What NOT to do in Step 1

- ❌ Do NOT install `chat`, `@chat-adapter/whatsapp`, `ai`, `elevenlabs`, or any AI/chat package yet — they come in Steps 2-4.
- ❌ Do NOT create any file inside `app/api/`.
- ❌ Do NOT create any file inside `app/dashboard/`.
- ❌ Do NOT run `npx shadcn init` yet — wait until Step 5.
- ❌ Do NOT add authentication, middleware, error tracking (Sentry), or analytics.
- ❌ Do NOT modify `app/page.tsx` beyond the placeholder shown.
- ❌ Do NOT create any test files. We test by running.

---

## Output expected

Reply with a final summary that includes:
1. List of every file created (with full paths)
2. Output of `pnpm typecheck` (must be clean)
3. A single line: `Step 1 done. Ready for Step 2.`
