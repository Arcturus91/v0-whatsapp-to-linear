import { getRedisClient } from '../redis/client';
import { StreamEvent } from './types';

const STREAM_KEY = 'linearvoice:events';
const EVENTS_LIST_KEY = 'linearvoice:event_ids';

export async function readRecentEvents(count: number = 50): Promise<StreamEvent[]> {
  const client = getRedisClient();
  try {
    const eventIds = await client.lrange(EVENTS_LIST_KEY, 0, count - 1);
    const events: StreamEvent[] = [];

    for (const eventId of eventIds) {
      const data = await client.get(`${STREAM_KEY}:${eventId}`);
      if (data && typeof data === 'string') {
        const parsed = JSON.parse(data);
        events.push({
          type: parsed.type,
          payload: JSON.parse(parsed.payload),
          timestamp: parseInt(parsed.timestamp),
        });
      }
    }

    return events;
  } catch (error) {
    console.error('[v0] Failed to read events:', error);
    return [];
  }
}

export async function readEventsSince(lastId: string): Promise<StreamEvent[]> {
  const client = getRedisClient();
  try {
    const eventIds = await client.lrange(EVENTS_LIST_KEY, 0, -1);
    const events: StreamEvent[] = [];
    let foundStart = false;

    for (const eventId of eventIds) {
      if (eventId === lastId) {
        foundStart = true;
        continue;
      }
      if (foundStart) {
        const data = await client.get(`${STREAM_KEY}:${eventId}`);
        if (data && typeof data === 'string') {
          const parsed = JSON.parse(data);
          events.push({
            type: parsed.type,
            payload: JSON.parse(parsed.payload),
            timestamp: parseInt(parsed.timestamp),
          });
        }
      }
    }

    return events;
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
  let lastEventId = '';

  while (true) {
    try {
      const newEvents = await readEventsSince(lastEventId);

      for (const event of newEvents) {
        // Track the last event ID by timestamp to handle subsequent reads
        lastEventId = `${event.timestamp}-*`;
        yield event;
      }
    } catch (error) {
      console.error('[v0] Error watching events:', error);
    }

    // Check periodically but don't block forever
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
