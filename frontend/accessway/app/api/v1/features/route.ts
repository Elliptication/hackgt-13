import type { NextRequest } from 'next/server'

import { fetchArea } from '@/lib/osm/osmapi'
import { cacheResponse, cachedResponse } from '@/lib/osm/responseCache'
import { featureTypeOf, nameByNearest, toFeature, wheelchairOf } from '@/lib/osm/transform'
import type { AccessFeature } from '@/types/features'
import { areaFor, fail, ok, responseKey } from '../_shared'

/** GET /api/v1/features?tile= — lifts, step-free entrances, restrooms, ramps. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const key = responseKey('features', params)

  // Transforming 34,000 raw elements is about a second; do it once per tile.
  const hit = cachedResponse<AccessFeature[]>(key)
  if (hit) return ok(hit)

  try {
    const elements = await fetchArea(areaFor(params).bbox)

    const features = elements.flatMap((el) => {
      const tags = el.tags
      if (!tags) return []
      const type = featureTypeOf(tags)
      if (!type) return []
      // A doorway that says nothing about access is noise, not information.
      if (type === 'accessible_entrance' && wheelchairOf(tags) === 'unknown' && tags.automatic_door !== 'yes') return []
      const feature = toFeature(el, type)
      return feature ? [feature] : []
    })

    return ok(cacheResponse(key, nameByNearest(features, elements)))
  } catch (error) {
    return fail(error)
  }
}
