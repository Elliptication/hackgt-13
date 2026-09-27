import type { NextRequest } from 'next/server'

import type { Accessibility, Place, PlaceCategory, WheelchairAccess } from '@/types/places'
import { fail, ok } from '../_shared'

/**
 * A cold cell means an ~11 MB fetch from OpenStreetMap, which is seconds rather
 * than milliseconds. Vercel's default function timeout is short enough to cut
 * that off and return a gateway error instead, so the ceiling is raised here.
 *
 * Warm cells answer from cache in milliseconds and never approach this.
 */
export const maxDuration = 60


/**
 * GET /api/v1/search?q=&bbox=
 *
 * Name search, backed by Nominatim — OpenStreetMap's own geocoder.
 *
 * Overpass was the wrong tool for this. It is an analytical query engine: it
 * answers "every cafe in this box" in seconds when it is idle, times out when
 * it is not, and rate-limits anything that asks often. Typing into it is
 * unusable. Nominatim is built for exactly this and answers in well under a
 * second, from a separate pool.
 *
 * It also searches the whole planet, so this works wherever the map is pointed.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

type NominatimResult = {
  osm_type?: string
  osm_id?: number
  place_id: number
  name?: string
  display_name: string
  lat: string
  lon: string
  category?: string
  type?: string
  address?: Record<string, string>
  extratags?: Record<string, string>
}

function categoryOf(result: NominatimResult): PlaceCategory {
  const type = result.type ?? ''
  const category = result.category ?? ''

  if (['restaurant', 'fast_food', 'bar', 'pub'].includes(type)) return 'restaurant'
  if (type === 'cafe') return 'cafe'
  if (type === 'library') return 'library'
  if (type === 'parking') return 'parking'
  if (type === 'toilets') return 'restroom'
  if (category === 'shop') return 'store'
  if (category === 'railway' || type === 'bus_stop' || type === 'station') return 'transit'
  return 'other'
}

function accessibilityOf(tags: Record<string, string>): Accessibility {
  const raw = tags.wheelchair
  const wheelchair: WheelchairAccess = raw === 'yes' || raw === 'limited' || raw === 'no' ? raw : 'unknown'

  const tri = (v?: string) => (v === 'yes' || v === 'designated' ? true : v === 'no' ? false : null)

  return {
    wheelchair,
    score: wheelchair === 'yes' ? 80 : wheelchair === 'limited' ? 50 : wheelchair === 'no' ? 10 : null,
    step_free_entrance: tri(raw),
    accessible_restroom: tri(tags['toilets:wheelchair']),
    elevator: null,
    automatic_door: tri(tags.automatic_door),
    notes: tags['wheelchair:description'] ?? null,
  }
}

/** "1234 Peachtree St, Midtown" — the long display_name is unreadable in a list. */
function shortAddress(result: NominatimResult) {
  const a = result.address ?? {}
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const area = a.neighbourhood ?? a.suburb ?? a.city ?? a.town ?? a.village
  const short = [street, area].filter(Boolean).join(', ')
  return short || result.display_name.split(',').slice(1, 3).join(',').trim() || null
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const q = params.get('q')?.trim()
  if (!q || q.length < 2) return ok<Place>([])

  const query = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '12',
    extratags: '1',
    addressdetails: '1',
  })

  const bbox = params.get('bbox')
  let viewbox: string | null = null
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
    if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
      viewbox = `${minLng},${maxLat},${maxLng},${minLat}`
    }
  }

  async function ask(bounded: boolean) {
    const q = new URLSearchParams(query)
    if (viewbox) {
      q.set('viewbox', viewbox)
      if (bounded) q.set('bounded', '1')
    }

    const res = await fetch(`${NOMINATIM}?${q}`, {
      headers: { 'User-Agent': 'AccessWay-HackGT/1.0 (student project)' },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(10_000),
    })

    return res.ok ? ((await res.json()) as NominatimResult[]) : []
  }

  try {
    // Search what is on screen first. Without `bounded=1` Nominatim treats the
    // viewbox as a gentle hint and happily returns a Starbucks in another state.
    let results = viewbox ? await ask(true) : []

    // Nothing nearby: widen out rather than claiming the place does not exist.
    if (results.length === 0) results = await ask(false)

    const places: Place[] = results.map((r) => ({
      id: r.osm_type && r.osm_id ? `osm-${r.osm_type}-${r.osm_id}` : `nominatim-${r.place_id}`,
      name: r.name || r.display_name.split(',')[0],
      category: categoryOf(r),
      lat: Number(r.lat),
      lng: Number(r.lon),
      address: shortAddress(r),
      accessibility: accessibilityOf(r.extratags ?? {}),
      features: [],
      updated_at: new Date().toISOString(),
    }))

    return ok(places)
  } catch (error) {
    return fail(error)
  }
}
