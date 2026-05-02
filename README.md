# LinearVoice

A sophisticated WhatsApp-to-Linear AI agent with voice support, real-time event streaming, and an intuitive dashboard. Built with Next.js, AI SDK, Upstash Redis, and Linear integration.

## Features

- **AI-Powered Chat**: Natural language interface to manage Linear issues via WhatsApp
- **Voice Support**: Convert text to speech and transcribe voice messages with ElevenLabs
- **Real-Time Events**: Stream Linear events and WhatsApp messages through Redis
- **Context Awareness**: Persistent conversation state for multi-turn interactions
- **Tool Integration**: Create, search, and update Linear issues directly from chat
- **Status Dashboard**: Real-time metrics and event monitoring
- **Webhook-Based Architecture**: Efficient message processing with verification

## Architecture

```
┌─────────────────┐
│   WhatsApp      │
│   (Kapso)       │
└────────┬────────┘
         │
         ↓
    ┌────────────┐
    │  Webhook   │────→ ProcessMessage
    │  /api/     │
    │  whatsapp  │
    └────────────┘
         │
         ↓
    ┌──────────────────┐
    │  Chat Bot        │
    │  (Message        │
    │   Handler)       │
    └────────┬─────────┘
             │
             ↓
    ┌──────────────────┐      ┌────────────┐
    │  AI Agent        │─────→│  Linear    │
    │  (Claude)        │      │  MCP       │
    └────────┬─────────┘      └────────────┘
             │
             ↓
    ┌──────────────────┐
    │  Redis Stream    │
    │  (Events)        │
    └──────────────────┘
```

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── whatsapp/           # Webhook endpoint for incoming messages
│   │   ├── test/send/          # Test endpoint for sending messages
│   │   └── metrics/            # Metrics API for dashboard
│   ├── layout.tsx
│   └── page.tsx                # Home page with setup guide
│
├── components/
│   ├── status-card.tsx         # Real-time status indicator
│   └── dashboard.tsx           # Metrics and event dashboard
│
├── lib/
│   ├── env.ts                  # Environment validation (Zod)
│   ├── chat/
│   │   ├── bot.ts              # Main bot orchestration logic
│   │   └── handlers.ts         # Message handlers for different types
│   ├── agent/
│   │   ├── handler.ts          # AI agent processing with Claude
│   │   └── tools.ts            # Tool definitions (Linear, Voice, Memory)
│   ├── events/
│   │   ├── types.ts            # Event type definitions
│   │   ├── emit.ts             # Event emission and state persistence
│   │   └── read.ts             # Event reading and metrics
│   └── redis/
│       └── client.ts           # Upstash Redis client singleton
│
├── .env.example                # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

## Setup Guide

### 1. Prerequisites

- Node.js 18+
- Accounts for:
  - [Kapso](https://kapso.dev) - WhatsApp API
  - [Linear](https://linear.app) - Project management
  - [Upstash](https://upstash.com) - Redis database
  - [ElevenLabs](https://elevenlabs.io) (optional) - Voice API

### 2. Environment Configuration

Copy `.env.example` to `.env.local` and fill in all required values:

```bash
cp .env.example .env.local
```

Key environment variables:
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` - Redis connection
- `KAPSO_AUTH_TOKEN` & `KAPSO_PHONE_ID` - WhatsApp API credentials
- `LINEAR_API_KEY` & `LINEAR_WORKSPACE_ID` - Linear integration
- `ELEVENLABS_API_KEY` & `ELEVENLABS_VOICE_ID` - Voice features (optional)

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Configure Webhook

In your Kapso WhatsApp console:
1. Set webhook URL to: `https://your-domain.com/api/whatsapp`
2. Set webhook token matching `KAPSO_WEBHOOK_TOKEN` in `.env.local`

### 5. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Webhook: POST /api/whatsapp
Receives incoming WhatsApp messages from Kapso.

**Request body:**
```json
{
  "from": "+1234567890",
  "to": "bot-number",
  "text": "Create a task to review PR #123",
  "mediaUrl": "https://...",
  "mediaType": "image",
  "timestamp": 1234567890
}
```

### Test: POST /api/test/send
Send a test message to verify the bot is working.

**Request body:**
```json
{
  "phoneNumber": "+1234567890",
  "message": "Hello bot!"
}
```

### Metrics: GET /api/metrics
Get event stream metrics for the dashboard.

**Response:**
```json
{
  "totalEvents": 42,
  "eventTypes": {
    "whatsapp.message": 25,
    "bot.response": 25,
    "linear.event": 5
  }
}
```

## Event Types

Events are streamed through Redis and include:

- **whatsapp.message** - Incoming WhatsApp messages
- **bot.response** - Bot responses sent back
- **linear.event** - Linear issue updates (create, update, comment)
- **voice.transcribed** - Voice transcription results

## Tool Use

The AI agent has access to three main tools:

### 1. Linear Issues (`createLinearIssue`)
- **action**: `create`, `search`, `update`
- **example**: "Create a bug issue about login flow not working"

### 2. Voice (`voice`)
- **action**: `text_to_speech`, `transcribe`
- **example**: "Convert this response to audio"

### 3. Memory (`memory`)
- **action**: `set`, `get`, `delete`
- **example**: "Remember that this user is a manager"

## Workflow

1. **Message Received** → WhatsApp webhook receives message
2. **Message Processed** → Chat bot extracts and validates message
3. **Agent Processing** → Claude processes with conversation context
4. **Tool Use** → Agent calls Linear tools if needed
5. **Response Generated** → Response sent back via WhatsApp
6. **Event Logged** → Events streamed to Redis for persistence and metrics

## State Management

Conversation state is stored in Redis with a TTL of 24 hours:
- Message history (up to 50 messages)
- Linear context (last issue, last query)
- User metadata

State is persisted after each interaction and loaded on reconnection.

## Monitoring

Access the dashboard at `/dashboard` (when implemented) to monitor:
- Real-time event stream
- Message metrics per conversation
- Linear issue activity
- Voice transcription accuracy
- System health status

## Development

### Environment Variables
Development mode uses `.env.local`. See `.env.example` for all available options.

### Type Safety
Project uses TypeScript. Run type checking:
```bash
pnpm exec tsc --noEmit
```

### Logging
Debug logs use the `[v0]` prefix and can be filtered:
```bash
DEBUG=linearvoice:* pnpm dev
```

## Deployment

### Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in project settings
4. Deploy

### Environment Variables on Vercel
Add all variables from `.env.example` in Vercel's environment variables UI.

### Webhook Configuration
After deployment, update Kapso webhook URL to your production domain.

## Troubleshooting

### "Redis connection failed"
- Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Ensure Redis instance is active in Upstash console

### "Linear API authentication failed"
- Verify `LINEAR_API_KEY` is valid and not expired
- Check `LINEAR_WORKSPACE_ID` matches your workspace

### "Messages not being received"
- Verify webhook URL is publicly accessible
- Check webhook token matches in Kapso console
- Review server logs for incoming requests

### "Agent not responding"
- Check AI Gateway or Anthropic API credentials
- Review Claude token limits
- Check Redis stream for error events

## Performance Considerations

- Conversation state is cached in memory (use `getConversationState()`)
- Redis operations use pipelining where possible
- Agent responses are streamed for immediate user feedback
- Event stream pruning keeps Redis usage bounded (max 1000 events)

## Security

- Webhook requests are verified against `WEBHOOK_SECRET`
- Redis data expires after 24 hours (TTL)
- API keys are not logged or exposed in frontend
- All external APIs use HTTPS

## Future Enhancements

- [ ] Voice transcription integration with ElevenLabs
- [ ] Multi-issue search and bulk operations
- [ ] Custom Linear issue templates
- [ ] User profile management per phone number
- [ ] Analytics dashboard with charts
- [ ] Scheduled issue reports
- [ ] Integration with other Linear fields (assignee, priority, etc.)

## Support

For issues or questions:
1. Check environment variables in `.env.local`
2. Review server logs for error messages
3. Verify all external API credentials
4. Check Upstash Redis connection status

## License

MIT
