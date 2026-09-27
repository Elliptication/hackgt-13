import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { fetchArea } from '@/lib/osm/osmapi'
import { cacheResponse, cachedResponse } from '@/lib/osm/responseCache'
import { toKerb, toPath } from '@/lib/osm/transform'
import type { KerbPoint, PathSegment } from '@/types/paths'
import { areaFor, fail, responseKey } from '../_shared'

/**
 * A cold cell means an ~11 MB fetch from OpenStreetMap, which is seconds rather
 * than milliseconds. Vercel's default function timeout is short enough to cut
 * that off and return a gateway error instead, so the ceiling is raised here.
 *
 * Warm cells answer from cache in milliseconds and never approach this.
 */
export const maxDuration = 60


/**
 * GET /api/v1/paths?tile= — the pedestrian network plus its kerbs.
 *
 * They travel together because they are only meaningful together: a perfect
 * sidewalk that ends at a high kerb is not a route.
 */
const WALKABLE = new Set(['footway', 'path', 'steps', 'pedestrian', 'living_street'])

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const key = responseKey('paths', params)

  const hit = cachedResponse<{ items: PathSegment[]; kerbs: KerbPoint[] }>(key)
  if (hit) return NextResponse.json({ ...hit, total: hit.items.length })

  try {
    const elements = await fetchArea(areaFor(params).bbox)

    const items = elements
      .filter((el) => el.type === 'way' && el.tags?.highway && WALKABLE.has(el.tags.highway))
      .map(toPath)
      .filter((p) => p !== null)

    const kerbs = elements
      .filter((el) => el.type === 'node' && (el.tags?.kerb || el.tags?.highway === 'crossing'))
      .map(toKerb)
      .filter((k) => k !== null)

    cacheResponse(key, { items, kerbs })
    return NextResponse.json({ items, total: items.length, kerbs })
  } catch (error) {
    return fail(error)
  }
}
