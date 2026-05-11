# Production Hardening — LinearVoice

Working through critical/suggestion/productionization items in order. One commit per item.

## Phase 1 status — COMPLETE (2026-05-11)

All 5 critical items closed across 5 commits on `main`:

| # | Commit | Summary |
|---|---|---|
| #1 | `08d138f` | Replaced `globalThis.fetch` monkey-patch with a scoped per-instance method override on `WhatsAppAdapter`; deleted `lib/kapso/webhook-adapter.ts`. |
| #5 | `32057ec` | `REDIS_URL` required in prod via zod refinement; `getBot()` warns once on memory-state fallback in dev; `/api/health` reports `dedupeState`. |
| #12 | `f891404` | `/api/test/send` gated by `TEST_ENDPOINT_SECRET` Bearer in prod (404 if unset), IP-rate-limited in dev. Added `?probe=1` short-circuit so the smoke doesn't burn AI tokens. |
| #3 | `6894bdc` | `crypto.randomUUID()` for event log IDs, handler emit IDs, and the synth `wamid.test-*` (scope expansion: included `app/api/test/send/route.ts` since same root cause, surfaced by #12 smoke). |
| #4 | `876910e` | Sliding-window circuit breaker on the rate limiters; fails CLOSED for 60s past 10 failures/60s; `rateLimiter` field on `/api/health` as pull-mode signal; `rate_limiter.degraded` stream event as push-mode (best-effort). |

**Smoke scripts now in place** (all run without burning paid APIs):

| Script | Coverage |
|---|---|
| `pnpm smoke:no-fetch-patch` | Static grep — no `globalThis.fetch` mutation or `patchFetchForKapso` references in `lib/` or `app/`. Regression guard for #1. |
| `pnpm smoke:prod-env` | Compiles `lib/env.ts` standalone, runs `envSchema.safeParse` against a synthetic prod env missing `REDIS_URL`, asserts the refinement rejects with `REDIS_URL` in the issue. Regression guard for #5. |
| `pnpm smoke:test-endpoint-auth` | 3 prod cases via compile-and-import on `lib/safety/test-endpoint-auth.ts` (404, 401, allow) + 1 dev case via live curl burst against the running dev server (6th hits 429). Regression guard for #12. Requires `pnpm dev` running. |
| `pnpm smoke:circuit-breaker` | 12 unit cases on the breaker state machine via compile-and-import — trip-at-11, single-shot `onTrip`, cooldown re-close, sliding-window correctness, snapshot fields. Regression guard for #4. |

The compile-and-import pattern (`pnpm exec tsc → .smoke-tmp → dynamic import`) is reused across the 3 unit smokes — candidate for a tiny shared helper if we add a 4th. The auth smoke also needs the dev server for the live-curl case; the other 3 are pure unit. All graduate to vitest in Phase 3 #C.

## Discovered During Hardening

Surfaced by Phase 1 work. Each one is a real-but-non-blocking finding; addressing in Phase 3 #A or earlier if they cause demo issues.

- [ ] **Bubble bot dispatch `res.ok=false` to non-2xx HTTP status** on `/api/test/send` and `/api/whatsapp`. Silent data loss (DoD #2). Surfaced by #12 — the smoke's 5th probe got a Chat SDK `LockError`, the route still wrapped it in HTTP 200, and the dropped message was invisible to the caller. The investigation script ran ad-hoc to confirm.
- [ ] **Structured log on Chat SDK `LockError`** — `conversationId`, lock TTL, what force-acquired the lock. Today the only signal of a dropped dispatch is a `[chat-sdk]` log line with no machine-readable context. Surfaced by same investigation as above.
- [ ] **Kapso auth header inconsistency** between `lib/kapso/client.ts` (`Authorization: Bearer`) and `lib/kapso/typing.ts` (`x-api-key`). Both apparently work against Kapso, but the inconsistency is a footgun for future Kapso work. Worth unifying to a single helper.
- [ ] **Test endpoint can't reach a real session for the synth phone** `+15550000000`. Every dispatch path hits Kapso 422 ("Cannot send non-template messages outside the 24-hour window"). The endpoint as-shipped is effectively probe-only in dev for synthetic phones; end-to-end testing requires a real phone in-session OR template messages OR a different mechanism. Limitation, not a bug.

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

## Phase 3 — Productionization

- [ ] **[A]** Structured-logging wrapper at `lib/log.ts` (JSON: level, event, conversationId, correlationId, durationMs); time STT/agent/TTS/Linear MCP.
- [ ] **[B]** Cost guardrails: daily budget tracker in Redis; `MAX_DAILY_BUDGET_USD`; capture AI Gateway token usage; static reply over budget.
- [ ] **[C]** Integration tests: vitest + @vitest/ui; mock Kapso payloads (synthetic generator from `/api/test/send`); HMAC + Meta translation + rate-limit; mock the agent.
- [ ] **[D]** CI: `.github/workflows/ci.yml` — install/typecheck/lint/build/test on push; block `main` on failure.
- [ ] **[E]** `docs/PROD_CHECKLIST.md`: every env var, source, failure mode (incl. `REDIS_URL` story).
