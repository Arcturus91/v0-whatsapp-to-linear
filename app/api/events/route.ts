import { NextRequest, NextResponse } from 'next/server'

import { readRecentEvents } from '@/lib/events/read'
import { StreamEvent } from '@/lib/events/types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function coerceLimit(rawLimit: string | null): number {
  if (!rawLimit) return DEFAULT_LIMIT
  const parsed = Number.parseInt(rawLimit, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

function parseTypes(rawTypes: string | null): Set<StreamEvent['type']> | null {
  if (!rawTypes) return null

  const types = rawTypes
    .split(',')
    .map(type => type.trim())
    .filter(Boolean) as StreamEvent['type'][]

  return types.length > 0 ? new Set(types) : null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const limit = coerceLimit(searchParams.get('limit'))
    const filterTypes = parseTypes(searchParams.get('types'))

    const events = await readRecentEvents(limit)
    const filtered = filterTypes
      ? events.filter(event => filterTypes.has(event.type))
      : events

    return NextResponse.json({
      total: filtered.length,
      events: filtered,
    })
  } catch (error) {
    console.error('[v0] Events API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch events',
        total: 0,
        events: [],
      },
      { status: 500 }
    )
  }
}
