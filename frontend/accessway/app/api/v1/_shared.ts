import { NextResponse } from 'next/server'

import type { Bbox } from '@/lib/geo/bbox'
import { parseBbox } from '@/lib/geo/bbox'
import { parseTileKey, tileToBbox, type Tile } from '@/lib/geo/tiles'
import { OsmApiError } from '@/lib/osm/osmapi'

/**
 * A stand-in backend, kept so the app can be demoed without FastAPI running.
 *
 * It is NOT the default path: lib/api/client.ts points at the real backend, and
 * these handlers only serve requests when NEXT_PUBLIC_API_BASE_URL is set back
 * to '/api/v1'. Deleting this folder and lib/osm/ is safe once the backend is
 * live — see BACKEND.md.
 *
 * Errors use FastAPI's native `{ detail }` shape so both sides match.
 */

export function ok<T>(items: T[], extra: Record<string, unknown> = {}) {
  return NextResponse.json({ items, total: items.length, ...extra })
}

export function fail(error: unknown) {
  if (error instanceof OsmApiError) {
    return NextResponse.json({ detail: error.message }, { status: error.status === 400 ? 400 : 502 })
  }
  const detail = error instanceof Error ? error.message : 'Something went wrong upstream.'
  return NextResponse.json({ detail }, { status: 500 })
}

/** `?tile=z/x/y` is the one that matters: it quantises space, so the same cell is always the same key. */
export function areaFor(params: URLSearchParams): { bbox: Bbox; tile: Tile | null } {
  const raw = params.get('tile')
  if (raw) {
    const tile = parseTileKey(raw)
    if (tile) return { bbox: tileToBbox(tile), tile }
  }
  return { bbox: parseBbox(params.get('bbox')), tile: null }
}

/** A stable key for a finished response: endpoint, area, and any filters. */
export function responseKey(endpoint: string, params: URLSearchParams, extra: string[] = []) {
  const area = params.get('tile') ?? params.get('bbox') ?? 'default'
  const filters = extra
    .flatMap((name) => params.getAll(name).map((v) => `${name}=${v}`))
    .sort()
    .join('&')
  return `${endpoint}:${area}${filters ? `:${filters}` : ''}`
}
