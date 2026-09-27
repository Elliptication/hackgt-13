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
 * to stay small — see MAX_SPAN. A cell that's still too dense (central Sydney,
 * London, Manhattan) is split into quarters and fetched piece by piece.
 */

const ENDPOINT = 'https://api.openstreetmap.org/api/0.6/map.json'

/** Widest area that reliably stays under the node cap. */
const MAX_SPAN = 0.024

/**
 * How many times a too-dense cell may be split in four. Two levels is up to 16
 * requests for one cell — slow, but it covers the densest city centres.
 */
const MAX_SPLITS = 2

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

function quarters(b: Bbox): Bbox[] {
  const midLat = (b.north + b.south) / 2
  const midLng = (b.east + b.west) / 2
  return [
    { south: midLat, north: b.north, west: b.west, east: midLng },
    { south: midLat, north: b.north, west: midLng, east: b.east },
    { south: b.south, north: midLat, west: b.west, east: midLng },
    { south: b.south, north: midLat, west: midLng, east: b.east },
  ]
}

/**
 * One box from the API. If it holds more than the node cap, it's split into
 * quarters and each is fetched in turn — one after another rather than all at
 * once, to stay within OpenStreetMap's usage policy.
 *
 * This used to shrink the box toward its centre and retry, which loaded the
 * middle of a dense area and silently dropped the rest — or, in a city centre,
 * failed outright after three shrinks.
 */
async function fetchBox(box: Bbox, splits = 0): Promise<RawElement[]> {
  const query = `${box.west},${box.south},${box.east},${box.north}`
  let lastError: unknown = null

  // One retry for a flaky connection; a too-dense or rate-limited answer isn't retried.
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await fetch(`${ENDPOINT}?bbox=${query}`, {
        headers: { 'User-Agent': 'AccessWay-HackGT/1.0 (student project)' },
        // Next's data cache rejects anything over 2MB and these are ~11MB, so
        // it cached nothing and warned on every request. readCache does the work.
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      lastError = error
      continue
    }

    if (res.status === 400) {
      // "You requested too many nodes".
      if (splits >= MAX_SPLITS) throw new OsmApiError(400, 'That area is too dense to load at once.')
      const parts: RawElement[] = []
      for (const part of quarters(box)) parts.push(...(await fetchBox(part, splits + 1)))
      return parts
    }

    if (res.status === 429 || res.status === 509) {
      throw new OsmApiError(res.status, 'OpenStreetMap is limiting how much we can download. Wait a minute, then move the map.')
    }

    if (!res.ok) {
      lastError = new OsmApiError(res.status, 'OpenStreetMap is unavailable right now.')
      continue
    }

    const body = (await res.json()) as { elements?: RawElement[] }
    return body.elements ?? []
  }

  throw lastError instanceof OsmApiError
    ? lastError
    : new OsmApiError(502, 'Could not reach OpenStreetMap. Try again in a moment.')
}

/** Everything OpenStreetMap holds for an area, cached, with stale fallback. */
export async function fetchArea(bbox: Bbox): Promise<OsmElement[]> {
  const area = clamp(bbox)
  const key = `osmapi:${area.west},${area.south},${area.east},${area.north}`

  const cached = readCache(key)
  if (cached && !cached.stale) return cached.elements

  try {
    const raw = await fetchBox(area)
    // Pieces of a split box overlap at their edges (a road crossing the line
    // comes back from both sides), so keep one copy of each element.
    const unique = [...new Map(raw.map((el) => [`${el.type}/${el.id}`, el])).values()]
    const elements = resolveGeometry(unique)
    writeCache(key, elements)
    return elements
  } catch (error) {
    if (cached) return cached.elements
    throw error
  }
}
