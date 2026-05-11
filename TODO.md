# Production Hardening — LinearVoice

Working through critical/suggestion/productionization items in order. One commit per item.

## Phase 1 — Critical

- [x] **#1** Replace `globalThis.fetch` monkey-patch in `lib/kapso/webhook-adapter.ts` with a scoped Kapso WhatsApp adapter; delete `patchFetchForKapso` / `fetchPatched`; add double-import smoke check.
- [x] **#5** Redis state required in production; `getBot()` throws when missing in prod; `.env.example` documents `REDIS_URL`; `/api/health` reports `dedupeState` (ok / degraded / fail); env zod refinement.
- [x] **#12** Lock down `/api/test/send` with `TEST_ENDPOINT_SECRET` (Bearer in prod, 404 if unset, IP rate-limit in dev).
- [x] **#3** Replace `Math.random().toString(36).slice(2, 8)` with `crypto.randomUUID()` in `lib/events/emit.ts` and `lib/chat/handlers.ts`.
- [x] **#4** Rate-limiter circuit breaker: track Redis failures in module counter, fail closed for 60s when >10 failures/min, emit `rate_limiter.degraded`, console.error.

## Phase 2 — Suggestions

- [ ] **#2** Switch dashboard reads to Upstash pipelines in `/api/conversations`; add `LIMIT` query param (default 50, max 200).
- [ ] **#10** Move event storage to Redis Streams (XADD/XREVRANGE, MAXLEN ~1000); read both old + new for one deploy, then delete.
- [ ] **#15** `LTRIM` per-conversation message list to last 200; add `MAX_CONVERSATION_EVENTS`.
- [ ] **#7** Bound thread history iteration in `buildAgentMessages`; break after `MAX_HISTORY_TURNS`; 32k char token-budget guard.
- [ ] **#6** Fail-loud webhook batch: 500 when all fail, DLQ failed items to `linearvoice:dlq`; `GET /api/admin/dlq` gated behind `TEST_ENDPOINT_SECRET`.
- [ ] **#9** Move issue-creation requirements from system prompt to tool schemas (refine MCP input schema OR wrap with Zod-validated tool).
- [ ] **#11** Split env into public/server bundles (`lib/env-public.ts`); audit `app/` imports.
- [ ] **#13** Apply Geist fonts in `<body>` via `${geist.variable} ${geistMono.variable}`, consume `--font-sans` / `--font-mono`.
- [ ] **#14** `typescript.ignoreBuildErrors: false` in `next.config.mjs`; fix whatever explodes.
- [ ] **#8** Audio duration guard from real STT duration; bump byte cap to 500KB.
- [ ] **#16** Correlation IDs in user-facing errors; `errors:${id}` in Redis (7d TTL); `GET /api/admin/errors/:id` gated.

## Discovered During Hardening

Surfaced by smoke/investigation work above. Address in Phase 3 #A or earlier if they cause demo issues.

- [ ] Bubble bot dispatch `res.ok=false` to non-2xx HTTP status on `/api/test/send` and `/api/whatsapp` (silent data loss, DoD #2). Surfaced by #12: the smoke's 5th probe got a Chat SDK `LockError`, returned `res.ok=false` from the bot, but the route still wrapped it in HTTP 200 — smoke couldn't see it.
- [ ] Structured log on Chat SDK `LockError`: `conversationId`, lock TTL, force-acquired-by. Surfaced by same investigation — the only signal of the dropped probe was a stray `[chat-sdk]` log line.

## Phase 3 — Productionization

- [ ] **[A]** Structured-logging wrapper at `lib/log.ts` (JSON: level, event, conversationId, correlationId, durationMs); time STT/agent/TTS/Linear MCP.
- [ ] **[B]** Cost guardrails: daily budget tracker in Redis; `MAX_DAILY_BUDGET_USD`; capture AI Gateway token usage; static reply over budget.
- [ ] **[C]** Integration tests: vitest + @vitest/ui; mock Kapso payloads (synthetic generator from `/api/test/send`); HMAC + Meta translation + rate-limit; mock the agent.
- [ ] **[D]** CI: `.github/workflows/ci.yml` — install/typecheck/lint/build/test on push; block `main` on failure.
- [ ] **[E]** `docs/PROD_CHECKLIST.md`: every env var, source, failure mode (incl. `REDIS_URL` story).
