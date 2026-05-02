import { getRedisClient } from '../redis/client';
import { StreamEvent, ConversationEvent, WhatsAppMessage, LinearEvent } from './types';

const STREAM_KEY = 'linearvoice:events';
const EVENTS_LIST_KEY = 'linearvoice:event_ids';

export async function emitStreamEvent(event: StreamEvent): Promise<void> {
  const client = getRedisClient();
  try {
    const eventId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const eventData = {
      id: eventId,
      type: event.type,
      payload: JSON.stringify(event.payload),
      timestamp: event.timestamp.toString(),
    };
    
    // Store event data as JSON
    const serialized = JSON.stringify(eventData);
    await client.set(`${STREAM_KEY}:${eventId}`, serialized, { ex: 86400 });
    // Maintain an ordered list of event IDs
    await client.lpush(EVENTS_LIST_KEY, eventId);
    // Keep only last 1000 events in the list
    await client.ltrim(EVENTS_LIST_KEY, 0, 999);
    
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
