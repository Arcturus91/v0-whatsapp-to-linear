/**
 * Event types emitted to Redis Stream `events:stream`.
 * Consumed by the dashboard SSE endpoint and REST endpoints.
 *
 * The shape matches V0_PROMPT.md so the PM's frontend can integrate
 * cleanly with predictable payloads.
 */
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
