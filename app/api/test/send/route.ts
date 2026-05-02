import { NextRequest, NextResponse } from 'next/server';
import { getBot } from '@/lib/chat/bot';
import { WhatsAppMessage } from '@/lib/events/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from = '+1234567890', text = 'test message' } = body;

    // Create a mock WhatsApp message
    const message: WhatsAppMessage = {
      id: `test-${Date.now()}`,
      from,
      to: '+1234567890',
      text,
      timestamp: Date.now(),
    };

    // Process it through the bot
    const bot = getBot();
    const response = await bot.processIncomingMessage(message);

    return NextResponse.json({
      success: true,
      message: 'Message processed',
      response,
      conversation: bot.getConversationState(from),
    });
  } catch (error) {
    console.error('[v0] Test send error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
