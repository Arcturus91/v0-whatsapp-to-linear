import { getBot } from './bot';
import { WhatsAppMessage } from '../events/types';
import { getEnv } from '../env';
import crypto from 'crypto';

const env = getEnv();

export interface KapsoWebhookPayload {
  event: string;
  message?: {
    id: string;
    from: string;
    to: string;
    type: 'text' | 'image' | 'document' | 'audio' | 'video';
    text?: string;
    mediaUrl?: string;
  };
  timestamp: number;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return digest === signature;
}

export async function handleKapsoWebhook(payload: KapsoWebhookPayload, signature?: string): Promise<any> {
  console.log('[v0] Received Kapso webhook:', payload);

  // Verify webhook signature if provided
  if (signature) {
    const payloadStr = JSON.stringify(payload);
    if (!verifyWebhookSignature(payloadStr, signature, env.WEBHOOK_SECRET)) {
      throw new Error('Invalid webhook signature');
    }
  }

  if (payload.event !== 'message_received' || !payload.message) {
    return { success: false, reason: 'Not a message event' };
  }

  const msg = payload.message;

  // Convert Kapso message to our internal format
  const whatsappMessage: WhatsAppMessage = {
    id: msg.id,
    from: msg.from,
    to: msg.to,
    text: msg.text,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.type as any,
    timestamp: payload.timestamp || Date.now(),
  };

  // Process with bot
  const bot = getBot();
  const response = await bot.processIncomingMessage(whatsappMessage);

  // TODO: Send response back via Kapso API
  // For now, just return the response
  return {
    success: true,
    response,
  };
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // TODO: Implement actual Kapso API call
  // For now, just log
  console.log(`[v0] Would send to ${to}: ${text}`);
  return {
    success: true,
    messageId: `msg-${Date.now()}`,
  };
}
