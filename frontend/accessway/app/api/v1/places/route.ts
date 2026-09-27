import type { NextRequest } from 'next/server'

import { fetchArea } from '@/lib/osm/osmapi'
import { cacheResponse, cachedResponse } from '@/lib/osm/responseCache'
import { toPlace } from '@/lib/osm/transform'
import type { Place } from '@/types/places'
import { areaFor, fail, ok, responseKey } from '../_shared'

/**
 * A cold cell means an ~11 MB fetch from OpenStreetMap, which is seconds rather
 * than milliseconds. Vercel's default function timeout is short enough to cut
 * that off and return a gateway error instead, so the ceiling is raised here.
 *
 * Warm cells answer from cache in milliseconds and never approach this.
 */
export const maxDuration = 60


/** Tag keys that mark an element as somewhere you might go. */
const PLACE_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'office', 'healthcare']

/** GET /api/v1/places?tile= &q= &category[]= &wheelchair[]= &limit= */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const key = responseKey('places', params, ['q', 'wheelchair', 'category', 'limit'])

  const hit = cachedResponse<Place[]>(key)
  if (hit) return ok(hit)

  try {
    const elements = await fetchArea(areaFor(params).bbox)

    let places = elements
      .filter((el) => el.tags?.name && PLACE_KEYS.some((k) => el.tags?.[k]))
      .map(toPlace)
      .filter((p) => p !== null)

    const q = params.get('q')?.toLowerCase()
    if (q) places = places.filter((p) => p.name.toLowerCase().includes(q))

    const wheelchair = params.getAll('wheelchair')
    if (wheelchair.length) places = places.filter((p) => wheelchair.includes(p.accessibility.wheelchair))

    const category = params.getAll('category')
    if (category.length) places = places.filter((p) => category.includes(p.category))

    // Best-documented first, so the list opens on rows someone can act on.
    places.sort(
      (a, b) => (b.accessibility.score ?? -1) - (a.accessibility.score ?? -1) || a.name.localeCompare(b.name),
    )

    const limit = Number(params.get('limit'))
    return ok(cacheResponse(key, Number.isFinite(limit) && limit > 0 ? places.slice(0, limit) : places))
  } catch (error) {
    return fail(error)
  }
}
