import { getRedisClient } from '../redis/client';
import { StreamEvent } from './types';

const STREAM_KEY = 'linearvoice:events';

export async function readRecentEvents(count: number = 50): Promise<StreamEvent[]> {
  const client = getRedisClient();
  try {
    const events = await client.xrevrange(STREAM_KEY, '+', '-', { count });
    return events.map(([id, data]: any) => ({
      type: data.type,
      payload: JSON.parse(data.payload),
      timestamp: parseInt(data.timestamp),
    }));
  } catch (error) {
    console.error('[v0] Failed to read events:', error);
    return [];
  }
}

export async function readEventsSince(lastId: string): Promise<StreamEvent[]> {
  const client = getRedisClient();
  try {
    const events = await client.xrange(STREAM_KEY, `(${lastId}`, '+');
    return events.map(([id, data]: any) => ({
      type: data.type,
      payload: JSON.parse(data.payload),
      timestamp: parseInt(data.timestamp),
    }));
  } catch (error) {
    console.error('[v0] Failed to read events since:', error);
    return [];
  }
}

export async function getMetrics(): Promise<{
  totalEvents: number;
  eventTypes: Record<string, number>;
}> {
  const client = getRedisClient();
  try {
    const events = await readRecentEvents(1000);
    const eventTypes: Record<string, number> = {};

    events.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      eventTypes,
    };
  } catch (error) {
    console.error('[v0] Failed to get metrics:', error);
    return { totalEvents: 0, eventTypes: {} };
  }
}

export async function* watchEvents() {
  const client = getRedisClient();
  let lastId = '0';

  while (true) {
    const events = await client.xread({ [STREAM_KEY]: lastId }, { block: 1000 });

    if (events.length > 0) {
      for (const [stream, streamEvents] of events) {
        for (const [id, data] of streamEvents) {
          lastId = id;
          yield {
            type: data.type,
            payload: JSON.parse(data.payload),
            timestamp: parseInt(data.timestamp),
          } as StreamEvent;
        }
      }
    }

    // Check periodically but don't block forever
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
