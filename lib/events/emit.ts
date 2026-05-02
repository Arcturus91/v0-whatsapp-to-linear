import { getRedisClient } from '../redis/client';
import { StreamEvent, ConversationEvent, WhatsAppMessage, LinearEvent } from './types';

const STREAM_KEY = 'linearvoice:events';

export async function emitStreamEvent(event: StreamEvent): Promise<void> {
  const client = getRedisClient();
  try {
    const eventId = await client.xadd(STREAM_KEY, '*', {
      type: event.type,
      payload: JSON.stringify(event.payload),
      timestamp: event.timestamp.toString(),
    });
    console.log(`[v0] Event emitted: ${event.type} (${eventId})`);
  } catch (error) {
    console.error('[v0] Failed to emit event:', error);
    throw error;
  }
}

export async function emitWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
  await emitStreamEvent({
    type: 'whatsapp.message',
    payload: message,
    timestamp: Date.now(),
  });
}

export async function emitLinearEvent(event: LinearEvent): Promise<void> {
  await emitStreamEvent({
    type: 'linear.event',
    payload: event,
    timestamp: Date.now(),
  });
}

export async function emitBotResponse(conversation: ConversationEvent): Promise<void> {
  await emitStreamEvent({
    type: 'bot.response',
    payload: conversation,
    timestamp: Date.now(),
  });
}

export async function emitVoiceTranscribed(transcript: ConversationEvent): Promise<void> {
  await emitStreamEvent({
    type: 'voice.transcribed',
    payload: transcript,
    timestamp: Date.now(),
  });
}

// Save conversation state
export async function saveConversationState(conversationId: string, state: any): Promise<void> {
  const client = getRedisClient();
  const key = `conversation:${conversationId}`;
  await client.set(key, JSON.stringify(state), { ex: 86400 }); // 24h expiry
  console.log(`[v0] Conversation state saved: ${conversationId}`);
}

// Get conversation state
export async function getConversationState(conversationId: string): Promise<any | null> {
  const client = getRedisClient();
  const key = `conversation:${conversationId}`;
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}
