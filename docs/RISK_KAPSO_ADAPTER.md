# RISK: Can `@chat-adapter/whatsapp` be pointed at Kapso?

**Status:** Research-only. No code changes.
**Date:** 2026-05-02

---

## 1. TL;DR

- **Yes — direct compatibility is achievable**, but only if Kapso's webhook is configured in `kind: "meta"` mode (raw forwarding). The adapter exposes an `apiUrl` override (and `WHATSAPP_API_URL` env var) that lets us swap Meta's Graph base URL for Kapso's proxy.
- **One non-trivial gotcha:** Kapso's outbound proxy expects `X-API-Key: <KAPSO_API_KEY>`, not `Authorization: Bearer`. The Chat SDK adapter uses `Authorization: Bearer <accessToken>`. Per the `@kapso/whatsapp-cloud-api` README, Kapso *also* accepts a Bearer access token if one is stored in Kapso, so the adapter likely works unmodified by passing the Kapso-stored token as `accessToken`. This must be verified empirically at install time — it is the single residual risk.
- **Webhook signing differs.** The Chat SDK verifies Meta's `X-Hub-Signature-256` using `WHATSAPP_APP_SECRET`. Kapso's "meta" webhook kind forwards Meta's payload but uses `X-Idempotency-Key` for dedupe and ships its own `X-Webhook-Signature` (HMAC-SHA256 over the raw body with the user-provided secret). If Kapso's "meta" mode passes Meta's original `X-Hub-Signature-256` through, signature verification works; if it strips it, we need the wrapper. **Also unverified.**

Recommendation below: try the **Direct path** first; if either of the two unverified items above breaks, fall back to a ~80-line wrapper.

---

## 2. Q1 — Does `@chat-adapter/whatsapp` accept a custom base URL?

**Yes.** The factory accepts `apiUrl` (and reads `WHATSAPP_API_URL` from env). Type signature published on the official Chat SDK adapter page:

```typescript
interface WhatsAppAdapterConfig {
  accessToken?: string;     // env: WHATSAPP_ACCESS_TOKEN
  appSecret?: string;       // env: WHATSAPP_APP_SECRET (X-Hub-Signature-256 verify)
  phoneNumberId?: string;   // env: WHATSAPP_PHONE_NUMBER_ID
  verifyToken?: string;     // env: WHATSAPP_VERIFY_TOKEN
  apiVersion?: string;      // default: "v21.0"
  userName?: string;        // env: WHATSAPP_BOT_USERNAME (defaults to "whatsapp-bot")
  apiUrl?: string;          // env: WHATSAPP_API_URL — "Override the Meta Graph API base URL"
  logger?: LoggerInstance;  // default: ConsoleLogger("info")
}
```

Source: https://chat-sdk.dev/adapters/whatsapp (the official Chat SDK docs).

The npm registry page (https://www.npmjs.com/package/@chat-adapter/whatsapp) returned 403 to my fetcher — I could not read `dist/index.d.ts` directly to triple-confirm field names. The docs page is canonical, but the literal field name (`apiUrl` vs `apiBase` vs `baseUrl`) should be cross-checked against the installed `.d.ts` once the package is in `node_modules`.

---

## 3. Q2 — Is Kapso's webhook payload byte-compatible with Meta?

**Conditionally yes.** Kapso supports two webhook "kinds":

| Kind | Payload | Behavior |
|------|---------|----------|
| `kapso` (default) | Kapso-flavored v2 (e.g. `{ message, conversation, is_new_conversation, phone_number_id }`) | Event filtering, buffering, structured fields like `kapso.direction` |
| `meta` | **Meta's exact unchanged payload** (`entry[].changes[].value.messages[]`) | No filtering, no buffering, raw forwarding, `X-Idempotency-Key` for dedupe; one allowed per phone number |

Kapso's default v2 format is **NOT** byte-compatible with Meta. Example v2 shape:
```json
{
  "message": { "id": "wamid.123", "type": "text", "from": "16315551181", "text": { "body": "Hello" }, "kapso": { ... } },
  "conversation": { "id": "conv_123", "phone_number_id": "..." },
  "is_new_conversation": true,
  "phone_number_id": "..."
}
```

So we MUST register Kapso webhook with `kind: "meta"` for the Chat SDK adapter to parse it without modification. Source: https://docs.kapso.ai/docs/platform/webhooks/overview.

**Webhook signature header — IMPORTANT MISMATCH:**
- Chat SDK adapter expects Meta's `X-Hub-Signature-256` (HMAC-SHA256 over raw body with `WHATSAPP_APP_SECRET`).
- Kapso documents `X-Webhook-Signature` (HMAC-SHA256 over raw body with the user-supplied webhook secret) for `kind: "kapso"`.
- For `kind: "meta"`, Kapso says the payload is forwarded unchanged with `X-Idempotency-Key`. The docs are **silent on whether Meta's original `X-Hub-Signature-256` is preserved.** This is unverified and is the single highest residual risk.

If Meta's original `X-Hub-Signature-256` IS forwarded, the adapter's `appSecret` verification works as-is when `WHATSAPP_APP_SECRET` is set to the Meta app secret tied to the Kapso-managed WABA (Kapso provisions the Meta app on your behalf, so this secret may not be exposed to you).

If Meta's signature is NOT forwarded, you must either:
1. Disable signature verification in the adapter (set `appSecret` to undefined, accept the security trade-off), then verify Kapso's `X-Webhook-Signature` upstream in route middleware before calling `bot.adapters.whatsapp.handleWebhook(request)`.
2. Or use the wrapper described in the recommendation.

---

## 4. Q3 — Does the adapter make outbound HTTP calls? Are they configurable?

**Yes — outbound is configurable** because of the `apiUrl` option. Documentation explicitly labels `apiUrl` as "Override the Meta Graph API base URL," confirming the adapter posts to `${apiUrl}/${apiVersion}/${phoneNumberId}/messages` (the standard Graph API path) when the bot calls `thread.post(...)`.

I could not read the adapter's source verbatim to confirm the exact URL template — the npm and chat-sdk pages returned partial content. But the existence of both `apiUrl` and `apiVersion` as config options strongly implies the URL is built as `${apiUrl}/${apiVersion}/...` rather than hardcoded to `https://graph.facebook.com`. This is the only sensible interpretation of those config options.

The outbound POST body is Meta's Cloud API shape (`{ messaging_product: "whatsapp", to, type: "text", text: { body } }`), because that's the contract of the `/messages` endpoint the adapter targets.

Auth header: the adapter uses `Authorization: Bearer ${accessToken}`. This matters for Q4.

---

## 5. Q4 — Is Kapso's outbound API Meta-compatible?

**Yes, body-shape compatible. Auth header is the catch.**

From the official `@kapso/whatsapp-cloud-api` README (https://github.com/gokapso/whatsapp-cloud-api-js):

```typescript
const client = new WhatsAppClient({
  baseUrl: "https://api.kapso.ai/meta/whatsapp",
  kapsoApiKey: process.env.KAPSO_API_KEY!,
});

// Raw payload mirrors Meta exactly:
await client.messages.sendRaw({
  phoneNumberId: "<PHONE_NUMBER_ID>",
  payload: {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "+15551234567",
    type: "text",
    text: { body: "Hello from a raw payload" },
  },
});
```

The README states: **"Responses mirror Meta's Cloud API message schema."**

| Property | Value |
|----------|-------|
| Base URL | `https://api.kapso.ai/meta/whatsapp` (NOT `https://app.kapso.ai/api/meta/` — that older path appears in some docs but the SDK/README is canonical) |
| Path after base | Identical to Meta: `/{phoneNumberId}/messages`, `/{mediaId}`, etc. (no version segment in the proxy base; Meta's `v21.0`-style version is omitted by Kapso) |
| Default auth | `X-API-Key: ${KAPSO_API_KEY}` |
| Bearer fallback | "You can also pass a bearer `accessToken` instead of `kapsoApiKey` if you've stored a token with Kapso." |
| Request body | **Identical to Meta's** Cloud API shape (snake_case: `messaging_product`, `recipient_type`, etc.) |
| Required extra | Media GET/DELETE requires `phoneNumberId` query param on the proxy (Meta does not need this) |

**The version-path mismatch:** Chat SDK builds URLs as `${apiUrl}/v21.0/${phoneNumberId}/messages`. Kapso's proxy expects `${baseUrl}/${phoneNumberId}/messages` with **no version segment**. So you cannot just set `apiUrl=https://api.kapso.ai/meta/whatsapp` — that would produce `https://api.kapso.ai/meta/whatsapp/v21.0/.../messages`, which Kapso may or may not accept.

There are two ways this could resolve:
1. Kapso silently ignores/accepts the `/v21.0` segment (possible — they aim to "mirror Meta's surface").
2. Set `apiUrl=https://api.kapso.ai/meta/whatsapp` AND `apiVersion=""` (empty string), if the adapter tolerates an empty version. Untested.

**Auth header:** Adapter sends `Authorization: Bearer <accessToken>`. Kapso accepts Bearer if a token is "stored with Kapso." So if Kapso provisions a token for you and you pass that as `WHATSAPP_ACCESS_TOKEN`, it should work without writing custom HTTP code. If only an API key is available, the adapter cannot natively send `X-API-Key` and a wrapper is required.

---

## 6. Recommendation

### Direct path (try first — ~5 minutes of config)

Verify three things at install time, then ship without writing adapter code:

```typescript
// lib/bot.ts
import { Chat } from "chat";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";

export const bot = new Chat({
  userName: "linearvoice",
  adapters: {
    whatsapp: createWhatsAppAdapter({
      accessToken: process.env.KAPSO_BEARER_TOKEN!,           // Kapso-issued Bearer (NOT the X-API-Key)
      apiUrl: "https://api.kapso.ai/meta/whatsapp",           // proxy base, no /v21.0
      apiVersion: "",                                         // try empty; if rejected, try "v21.0" — Kapso may accept it
      phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID!,
      appSecret: process.env.WHATSAPP_APP_SECRET,             // only meaningful if Kapso forwards Meta's X-Hub-Signature-256
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
    }),
  },
});
```

```bash
# .env
WHATSAPP_API_URL=https://api.kapso.ai/meta/whatsapp
WHATSAPP_ACCESS_TOKEN=<Kapso-issued bearer>
WHATSAPP_PHONE_NUMBER_ID=<from Kapso dashboard>
WHATSAPP_VERIFY_TOKEN=<arbitrary, must match Kapso webhook config>
WHATSAPP_APP_SECRET=<Meta app secret IF Kapso exposes it; else leave unset and rely on TLS>
```

Register the Kapso webhook with `kind: "meta"` so payloads arrive in Meta-native shape.

**Three install-time checks:**
1. Send a test text — does Kapso accept the URL with the `/v21.0` segment, or do we need `apiVersion: ""`?
2. Receive a test inbound — does the parsed payload look right (yes, if `kind: "meta"` works as advertised)?
3. Does the Bearer token actually work, or does Kapso reject it and demand `X-API-Key`?

If all three pass: ship as-is, total adapter code = 0 lines.

### Wrapper path (fallback — only if any of the three fail)

```typescript
// lib/kapso/webhook-adapter.ts  (~80 lines)
import { createHmac, timingSafeEqual } from "node:crypto";

// 1) Inbound: thin wrapper around bot.adapters.whatsapp.handleWebhook
//    - verify Kapso's X-Webhook-Signature instead of Meta's X-Hub-Signature-256
//    - if Kapso uses "kapso" kind v2 format, transform to Meta shape before forwarding
export async function handleKapsoWebhook(req: Request) {
  const raw = await req.text();
  if (!verifyKapsoSig(raw, req.headers.get("x-webhook-signature"))) {
    return new Response("bad sig", { status: 401 });
  }
  const body = JSON.parse(raw);
  const metaShaped = isKapsoV2(body) ? toMetaShape(body) : body;
  // hand a synthetic Request to the adapter with Meta-shape body and a freshly-computed
  // X-Hub-Signature-256 using WHATSAPP_APP_SECRET so the adapter's verifier passes
  const synth = synthesizeMetaRequest(metaShaped);
  return bot.adapters.whatsapp.handleWebhook(synth);
}

// 2) Outbound: monkey-patch global fetch ONLY for graph.facebook.com /
//    api.kapso.ai/meta/whatsapp paths to inject X-API-Key when needed.
//    Or wrap the adapter in a Proxy that intercepts calls.
//    Cleanest: set apiUrl to a localhost:0 sink and write our own send() — but
//    that defeats the purpose of using the adapter. Better: just rewrite headers via fetch.
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, init = {}) => {
  if (typeof url === "string" && url.startsWith("https://api.kapso.ai/meta/whatsapp")) {
    const headers = new Headers(init.headers);
    headers.delete("authorization");
    headers.set("x-api-key", process.env.KAPSO_API_KEY!);
    return originalFetch(url, { ...init, headers });
  }
  return originalFetch(url, init);
};

function verifyKapsoSig(raw: string, sig: string | null) { /* HMAC-SHA256, timing-safe compare */ }
function isKapsoV2(body: any) { return "message" in body && "conversation" in body; }
function toMetaShape(v2: any) {
  // produce { object: "whatsapp_business_account",
  //   entry: [{ id: v2.phone_number_id, changes: [{ value: {
  //     messaging_product: "whatsapp",
  //     metadata: { phone_number_id: v2.conversation.phone_number_id, display_phone_number: "" },
  //     contacts: [{ wa_id: v2.message.from, profile: { name: v2.conversation.username } }],
  //     messages: [v2.message],
  //   }, field: "messages" }] }] }
}
function synthesizeMetaRequest(metaBody: any) {
  const body = JSON.stringify(metaBody);
  const sig = "sha256=" + createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(body).digest("hex");
  return new Request("http://internal/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": sig },
    body,
  });
}
```

Wire this in your Next.js route as `POST = handleKapsoWebhook` instead of calling the adapter directly.

---

## 7. Risks I uncovered

1. **`apiUrl` literal field name unverified against `dist/index.d.ts`.** The chat-sdk.dev docs say `apiUrl`. If the actual `.d.ts` calls it `apiBase` or `baseUrl`, our env var name needs to change. Low risk (will be obvious at first `tsc` run).

2. **Version-path mismatch.** Chat SDK adapter likely concatenates `apiVersion` into the URL. Kapso's proxy base (`api.kapso.ai/meta/whatsapp`) does not use a version segment. Need to test with `apiVersion: ""`, or accept that Kapso may forgive the extra `/v21.0/`. Medium risk.

3. **Auth header mismatch.** Adapter sends `Authorization: Bearer`, Kapso natively wants `X-API-Key`. Kapso supports Bearer "if stored." Need to confirm Kapso lets us provision a Bearer token for the proxy. **Highest risk** of the three — failure here forces the fetch-monkey-patch wrapper.

4. **Webhook signature pass-through.** Kapso's `kind: "meta"` docs say "raw forwarding" but don't explicitly confirm `X-Hub-Signature-256` survives. If Kapso terminates Meta's connection and re-sends, the signature will be over Kapso's body (still raw) but will require Meta's app secret which you may not have if Kapso provisioned the Meta app for you. Likely workaround: Kapso exposes the Meta app secret in their dashboard, OR we disable adapter sig verification and verify `X-Webhook-Signature` upstream.

5. **`@chat-adapter/whatsapp` may be Vercel-private / not on public npm.** I got 403 from npmjs.com (could be rate limit, could be private package). If private, we won't know the real signature until we have access. Worst case, we follow the adapter's docs verbatim.

6. **Idempotency.** Kapso adds `X-Idempotency-Key` headers. Chat SDK adapter does not natively dedupe on this header — webhook retries could cause duplicate processing. Low risk for hackathon scope, but worth noting.

7. **Kapso v2-only fields like `business_scoped_user_id` and `kapso.*` are dropped** when using `kind: "meta"`. If we ever want them, we have to switch to `kind: "kapso"` and lose direct adapter compatibility.

---

## 8. Sources

- Chat SDK official adapter docs: https://chat-sdk.dev/adapters/whatsapp
- npm package page (403 to fetcher, listed for completeness): https://www.npmjs.com/package/@chat-adapter/whatsapp
- Kapso docs index/llms.txt: https://docs.kapso.ai/llms.txt
- Kapso webhook overview: https://docs.kapso.ai/docs/platform/webhooks/overview
- Kapso webhook security: https://docs.kapso.ai/docs/platform/webhooks/security
- Kapso webhook event types (v2 payload sample): https://docs.kapso.ai/docs/platform/webhooks/event-types
- Kapso WhatsApp API overview: https://docs.kapso.ai/api/meta/whatsapp/whatsapp-api-overview
- Kapso TypeScript SDK introduction: https://docs.kapso.ai/docs/whatsapp/typescript-sdk/introduction
- `@kapso/whatsapp-cloud-api` GitHub README (canonical for proxy URL/auth): https://github.com/gokapso/whatsapp-cloud-api-js
- `@kapso/whatsapp-cloud-api` npm: https://www.npmjs.com/package/@kapso/whatsapp-cloud-api
- Reference integration project: https://github.com/Enriquefft/openclaw-kapso-whatsapp
