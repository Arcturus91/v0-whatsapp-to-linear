import { NextRequest, NextResponse } from 'next/server';
import { handleKapsoWebhook, KapsoWebhookPayload } from '@/lib/chat/handlers';

export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from headers
    const signature = request.headers.get('x-kapso-signature');

    // Parse JSON body
    const payload = (await request.json()) as KapsoWebhookPayload;

    // Process webhook
    const result = await handleKapsoWebhook(payload, signature || undefined);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[v0] Webhook error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Webhook verification endpoint (for Kapso setup)
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const verifyToken = request.nextUrl.searchParams.get('hub.verify_token');

  if (!challenge || !verifyToken) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // TODO: Verify token matches your configured token
  // For now, just echo back the challenge
  if (verifyToken === 'verify_me') {
    return NextResponse.json({ status: 'ok', challenge }, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}
