export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface LinearEvent {
  type: 'issue.created' | 'issue.updated' | 'comment.created';
  issueId: string;
  title: string;
  description: string;
  status: string;
  authorName: string;
  timestamp: number;
}

export interface ConversationEvent {
  id: string;
  conversationId: string;
  userId: string; // WhatsApp phone number
  type: 'message' | 'linear_event' | 'voice_note';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface RateLimiterDegradedEvent {
  reason: 'redis_failures_exceeded_threshold';
  failuresInWindow: number;
  openForSeconds: number;
  timestamp: number;
}

export interface StreamEvent {
  type:
    | 'whatsapp.message'
    | 'linear.event'
    | 'bot.response'
    | 'voice.transcribed'
    | 'rate_limiter.degraded';
  payload:
    | WhatsAppMessage
    | LinearEvent
    | ConversationEvent
    | RateLimiterDegradedEvent;
  timestamp: number;
}

export interface ConversationState {
  id: string;
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  linearContext?: {
    lastIssueId?: string;
    lastQuery?: string;
  };
  createdAt: number;
  updatedAt: number;
}
