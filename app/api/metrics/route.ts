import { getMetrics } from '@/lib/events/read';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const metrics = await getMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[v0] Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', totalEvents: 0, eventTypes: {} },
      { status: 500 }
    );
  }
}
