# LinearVoice — Bot WhatsApp ↔ Linear

> Doc para alinear con PM. Track 3 de la hackathon: **Chat SDK Agents**.

## TL;DR

Bot al que le hablas por WhatsApp (texto o audio) y crea/lee/actualiza tasks de Linear. Dashboard web en paralelo para que los jueces vean lo que pasa en tiempo real.

**Stack core:** Vercel Chat SDK + AI SDK + AI Gateway + Kapso (WhatsApp) + Linear MCP + ElevenLabs (voz).

---

## Demo (60s)

1. Mando audio a un número de WhatsApp: *"crea un ticket urgente, login roto en mobile"*
2. Bot transcribe → razona → crea issue en Linear → responde con audio + texto: *"listo, ENG-1234 creado con prioridad Urgent"*
3. Mando texto: *"qué tengo pendiente para mañana?"*
4. Bot devuelve lista de issues con due date
5. **Dashboard web** (lo que tú construyes) muestra mensajes, tool calls, costos del LLM y issues afectados en vivo

---

## Arquitectura completa

```
┌────────────────────────────────────────────────────────────────────┐
│                      CAPA DE USUARIO                               │
│                                                                    │
│  Usuario WhatsApp ←→ texto + audio                                 │
└─────────────────┬──────────────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                      CAPA DE TRANSPORTE                            │
│                                                                    │
│  Kapso (WhatsApp Cloud API proxy)                                  │
│   • Sandbox sin Meta Business verification                         │
│   • Free tier 2k mensajes/mes                                      │
│   • Webhook con retry policies                                     │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ POST webhook
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│              VERCEL — Next.js (Fluid Compute)                      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ /api/whatsapp  (route handler)                               │  │
│  │                                                              │  │
│  │  ▶ Chat SDK (`chat`)                                         │  │
│  │     - @chat-adapter/whatsapp (apiBase → Kapso)               │  │
│  │     - state: @chat-adapter/state-redis                       │  │
│  │     - dedupe + locks distribuidos                            │  │
│  │                                                              │  │
│  │  ▶ Handler: bot.onDirectMessage(thread, msg)                 │  │
│  │     1. Si msg es audio → ElevenLabs STT                      │  │
│  │     2. Invoca ToolLoopAgent con el texto                     │  │
│  │     3. Stream respuesta a WhatsApp                           │  │
│  │     4. Si pide voz → ElevenLabs TTS → audio attachment       │  │
│  │     5. Emite evento a Redis Stream (para dashboard)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ AI Layer                                                     │  │
│  │   AI Gateway → modelo: anthropic/claude-sonnet-4.6           │  │
│  │                fallback: openai/gpt-5.4                      │  │
│  │   ToolLoopAgent con tools:                                   │  │
│  │     • Linear MCP   → create_issue, list_issues, update_issue │  │
│  │     • Kapso MCP    → segundo canal (opcional, fase 2)        │  │
│  │     • ElevenLabs   → TTS (voz de respuesta)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ /api/events  (SSE)         /dashboard  (App Router)          │  │
│  │   ▲                          ▲                               │  │
│  │   │  stream eventos          │  UI tiempo real (TU SCOPE)    │  │
│  │   │                          │                               │  │
│  │   └──────────────────────────┘                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Datos — Redis (Upstash, Vercel Marketplace, 1-click)         │  │
│  │   • Chat SDK state (locks, dedupe, subscriptions)            │  │
│  │   • Event log para dashboard (Redis Streams: events:stream)  │  │
│  │   • Conversaciones (HSET conversation:{id})                  │  │
│  │   • TTL 24h auto-cleanup post-demo                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                      CAPA DE INTEGRACIONES                         │
│                                                                    │
│  Linear API (vía MCP)   ElevenLabs API   Kapso API                 │
└────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
FASE 2 — Agente proactivo (post-hackathon, opcional para demo)
═══════════════════════════════════════════════════════════════════

  AWS EventBridge (cron 15min)
         │
         ▼
  AWS Lambda
   ▶ Linear API: detecta issues stale / overdue / sin owner
   ▶ POST /api/proactive en Vercel
         │
         ▼
  Chat SDK → thread.openDM(user) → mensaje proactivo
   "Oye, ENG-1234 lleva 3 días sin update — ¿lo cierro o lo escalo?"
```

---

## División de trabajo

### 🟦 Backend (yo)

| Item | Tech |
|---|---|
| Kapso webhook + Chat SDK setup | `chat`, `@chat-adapter/whatsapp` |
| Voice in/out con ElevenLabs | `@elevenlabs/elevenlabs-js` |
| Tool loop con Linear MCP | `ai`, MCP client |
| Event log emitter | Redis Streams (Upstash) |
| SSE endpoint para dashboard | Next.js route handler |
| Deploy + env vars | Vercel |

### 🟩 Frontend (PM)

**Stack sugerido:**
- Next.js App Router (mismo repo, todo bajo `app/dashboard/`)
- shadcn/ui + Tailwind
- SSE (`EventSource`) para tiempo real
- Datos vía endpoints REST que yo expongo

**Páginas a construir:**

#### 1. `/dashboard` — Live feed (pantalla principal del demo)
Layout 3-paneles:

| Panel | Contenido |
|---|---|
| **Izquierda** — Conversaciones | Lista de threads de WhatsApp activos, con el último mensaje y unread count. Click → abre thread |
| **Centro** — Thread activo | Conversación tipo iMessage: bubbles del usuario y del bot, audios reproducibles, indicador "typing…" cuando está streameando |
| **Derecha** — Tool calls | Stack de cards mostrando cada tool call: nombre (`linear.create_issue`), input JSON, output JSON, latencia, costo. Cards aparecen animadas en orden cronológico |

#### 2. `/dashboard/metrics` — Métricas en vivo
- Mensajes procesados (total + última hora)
- Tokens usados + costo acumulado (del AI Gateway)
- Issues de Linear creados / actualizados
- P50/P95 latencia end-to-end (audio recibido → respuesta enviada)
- Modelo usado (con badge si hay failover activo)

#### 3. `/dashboard/conversations/[id]` — Detalle histórico
- Conversación completa con timeline de tool calls intercalados
- Replay del audio de entrada y salida
- Link al issue de Linear creado (si aplica)

#### 4. `/` — Landing simple
- "LinearVoice — habla por WhatsApp, planea con Linear"
- QR del número de WhatsApp del demo
- CTA: "Mandá un mensaje al número" + link al dashboard

---

## Endpoints que yo expongo para el frontend

```ts
// SSE — eventos en tiempo real
GET  /api/events                          // text/event-stream
     // emite: message_received, tool_call_started, tool_call_finished,
     //         message_sent, error

// REST
GET  /api/conversations                   // lista threads
GET  /api/conversations/:id               // thread + mensajes + tool calls
GET  /api/metrics                         // contadores agregados
GET  /api/issues                          // issues tocados desde Linear
POST /api/test/send                       // envía un mensaje de prueba (para QA)
```

### Schema simplificado (Redis)

```
events:stream                          # Redis Stream — feed cronológico
                                       #   tipo: message_received |
                                       #         tool_call_started |
                                       #         tool_call_finished |
                                       #         message_sent | error
conversation:{id}                      # HASH — metadata del thread
conversation:{id}:messages             # LIST — mensajes ordenados
conversation:{id}:tool_calls           # LIST — tool calls del thread
issues:touched                         # SET — Linear IDs tocados en demo
metrics:counters                       # HASH — contadores agregados
```

TTL de 24h en todas las keys → auto-cleanup post-demo.

---

## Stack final

| Layer | Tech | Por qué |
|---|---|---|
| Surface | **Kapso** sandbox | Sin Meta verification, free tier, oficial |
| Track requirement | **Vercel Chat SDK** (`chat`) | Track 3 lo exige; threading + dedupe gratis |
| AI | **AI SDK v6** + **AI Gateway** | Tool loop + multi-modelo + free credits |
| Tools | **Linear MCP** oficial | Standard, no escribimos integration |
| Voz | **ElevenLabs** | Audio in (STT) + audio out (TTS) por WhatsApp |
| State + event log | **Redis** (Upstash via Vercel Marketplace, 1-click) | Chat SDK state + Streams para dashboard |
| Frontend | **Next.js App Router** + **shadcn/ui** | Mismo repo, deploy unificado |
| Realtime | **SSE** | Más simple que WebSocket, suficiente |
| Hosting | **Vercel** | Fluid Compute, free tier OK |
| Fase 2 | **AWS EventBridge + Lambda** | Cron para agente proactivo |

---

## Plan de ejecución (24-36h hackathon)

| Hora | Backend (yo) | Frontend (PM) |
|---|---|---|
| 0-2 | Scaffold Next.js, Vercel link, env, Kapso sandbox activado | Setup shadcn, layout base, routing |
| 2-4 | Chat SDK + WhatsApp adapter + ping-pong funcionando | Mockear UI con datos fake (paneles 3) |
| 4-6 | ToolLoopAgent + Linear MCP integrado, crea issues por texto | Conectar SSE, mostrar mensajes en vivo |
| 6-8 | ElevenLabs STT + TTS para audios | Tool call cards animadas, audio player |
| 8-10 | Event logging a Redis Streams + endpoints REST | Página de métricas + landing |
| 10-12 | Polish: error handling, multi-team support en Linear | Polish: dark mode, animaciones, copy |
| 12+ | Fase 2 si da tiempo: AWS proactive | Demo recording + screenshots |

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `@chat-adapter/whatsapp` no acepta `apiBase` custom para Kapso | Wrapper de ~20 líneas que traduce webhook Kapso al shape del adapter. 30 min de costo |
| Latencia de ElevenLabs alta para audio | Empezar respuesta de texto inmediato, audio en segunda fase del stream |
| Linear MCP rate limits | Cache de `list_teams` / `list_projects` en Redis (no cambian) |
| WhatsApp 24h window | Para demo no aplica (bot reactivo); fase 2 usa templates |
| Demo falla en vivo | Tener video grabado de fallback + dashboard con datos pre-cargados |

---

## Costos estimados (hackathon)

| Servicio | Plan free tier | Suficiente para 36h? | Costo |
|---|---|---|---|
| Kapso | 2,000 msgs/mes | Sí (estimado <500 msgs) | $0 |
| Vercel | Hobby (sin tarjeta) | Sí | $0 |
| Upstash Redis (Vercel Marketplace) | 10k commands/día, 256MB | Sí | $0 |
| AI Gateway | $5 créditos/mes por team | Sí (~$2-3 estimado con Claude Sonnet 4.6) | $0 |
| ElevenLabs | 10k chars/mes (TTS) | Borderline — si llegamos al límite, Starter | $0–$5 |
| Linear | Plan existente | — | $0 (ya pago) |
| AWS (fase 2 opcional) | Free tier EventBridge + Lambda | Sí | $0 |
| **Total** | | | **$0–$5** |

**Notas:**
- AI Gateway free credit se renueva mensual; basta y sobra para hackathon
- Si ElevenLabs se queda corto, fallback a respuesta solo-texto (no rompe demo)
- Costo real probable: **$0**

---

## Lo que NO vamos a hacer (scope cut explícito)

- ❌ Multi-tenant / multi-workspace de Linear (uno solo, hardcoded)
- ❌ Auth de usuarios en el dashboard (público o password único)
- ❌ Mobile app (WhatsApp ya es nuestro mobile)
- ❌ Voice calls de WhatsApp (solo notas de voz)
- ❌ Templates aprobadas en Meta (sandbox basta)
- ❌ Soporte multi-idioma (español de entrada, español de salida)

---

## Próximos pasos inmediatos

1. **PM**: confirma esta arquitectura y stack del frontend
2. **Yo**: scaffolding del proyecto + Kapso sandbox activado
3. **Ambos**: definir contrato exacto de los endpoints (puedo bajar el schema antes de que empieces a codear UI)
