import 'server-only'

import type { Bbox } from '@/lib/geo/bbox'

import { readCache, writeCache } from './cache'
import type { OsmElement } from './types'

/**
 * OpenStreetMap's own data API.
 *
 * Instead of answering a question it hands back everything in a bounding box,
 * so the three data routes share a single fetch per cell rather than querying
 * separately. One Georgia Tech cell is ~34,000 elements in ~4 s.
 *
 * Not Overpass: that returns HTTP 504 under load, rate-limits by IP and then
 * black-holes the connection, and can return HTTP 200 with valid JSON followed
 * by an HTML error block.
 *
 * The tradeoff here is a hard cap of 50,000 nodes per request, so the bbox has
 * to stay small — see MAX_SPAN and the shrink-and-retry below.
 */

const ENDPOINT = 'https://api.openstreetmap.org/api/0.6/map.json'

/** Widest area that reliably stays under the node cap. */
const MAX_SPAN = 0.024

/** Raw shape from the API: ways carry node ids, not coordinates. */
type RawElement = OsmElement & { nodes?: number[] }

export class OsmApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'OsmApiError'
  }
}

function clamp(b: Bbox, span = MAX_SPAN): Bbox {
  const latSpan = b.north - b.south
  const lngSpan = b.east - b.west
  if (latSpan <= span && lngSpan <= span) return b

  const midLat = (b.north + b.south) / 2
  const midLng = (b.east + b.west) / 2
  const half = span / 2
  return {
    south: Math.max(b.south, midLat - half),
    north: Math.min(b.north, midLat + half),
    west: Math.max(b.west, midLng - half),
    east: Math.min(b.east, midLng + half),
  }
}

/**
 * Turn node ids into coordinates. The API returns every node in the box, so a
 * way's geometry can be assembled without further requests — which is why one
 * fetch can serve every endpoint.
 */
function resolveGeometry(elements: RawElement[]): OsmElement[] {
  const nodes = new Map<number, { lat: number; lon: number }>()
  for (const el of elements) {
    if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
      nodes.set(el.id, { lat: el.lat, lon: el.lon })
    }
  }

  return elements.map((el) => {
    if (el.type !== 'way' || !el.nodes?.length) return el
    const geometry = el.nodes.map((id) => nodes.get(id)).filter((n) => n !== undefined)
    if (geometry.length === 0) return el
    const mid = geometry[Math.floor(geometry.length / 2)]
    return { ...el, geometry, center: { lat: mid.lat, lon: mid.lon } }
  })
}

/** Everything OpenStreetMap holds for an area, cached, with stale fallback. */
export async function fetchArea(bbox: Bbox): Promise<OsmElement[]> {
  const area = clamp(bbox)
  const key = `osmapi:${area.west},${area.south},${area.east},${area.north}`

  const cached = readCache(key)
  if (cached && !cached.stale) return cached.elements

  let span = MAX_SPAN
  let lastError: unknown = null

  for (let attempt = 0; attempt < 3; attempt++) {
    const box = clamp(bbox, span)
    const query = `${box.west},${box.south},${box.east},${box.north}`

    try {
      const res = await fetch(`${ENDPOINT}?bbox=${query}`, {
        headers: { 'User-Agent': 'AccessWay-HackGT/1.0 (student project)' },
        // Next's data cache rejects anything over 2MB and these are ~11MB, so
        // it cached nothing and warned on every request. readCache does the work.
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      })

      if (res.status === 400) {
        // "You requested too many nodes" — shrink and try again.
        span *= 0.55
        lastError = new OsmApiError(400, 'That area is too dense to load at once.')
        continue
      }

      if (!res.ok) {
        lastError = new OsmApiError(res.status, 'OpenStreetMap is unavailable right now.')
        continue
      }

      const body = (await res.json()) as { elements?: RawElement[] }
      const elements = resolveGeometry(body.elements ?? [])
      writeCache(key, elements)
      return elements
    } catch (error) {
      lastError = error
    }
  }

  if (cached) return cached.elements

  throw lastError instanceof OsmApiError
    ? lastError
    : new OsmApiError(502, 'Could not reach OpenStreetMap. Try again in a moment.')
}
