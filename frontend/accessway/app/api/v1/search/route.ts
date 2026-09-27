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
 * Type-ahead search for the From and To fields: places, addresses, streets,
 * cities and countries, anywhere in the world.
 *
 * Backed by Photon (photon.komoot.io), a geocoder built on OpenStreetMap data
 * for exactly this — search as you type. It ranks by how prominent a place is
 * *and* how close it is, in one query, so "Starbucks" finds the ones nearby
 * while "Sydney" still finds Sydney, Australia rather than Sydney Street.
 *
 * This used to call Nominatim, first limited to the area on screen and only
 * wider if that found nothing at all. Anything nearby with a matching word won,
 * so a city or an address elsewhere never came up. Nominatim's usage policy also
 * rules out search-as-you-type.
 *
 * Photon does not return OpenStreetMap's accessibility tags, so the places it
 * finds get one batched Nominatim lookup for `wheelchair=*` (one request per
 * search, not per keystroke — the hook waits for typing to pause).
 */

const PHOTON = 'https://photon.komoot.io/api/'
const NOMINATIM_LOOKUP = 'https://nominatim.openstreetmap.org/lookup'
const USER_AGENT = 'AccessWay-HackGT/1.0 (student project)'

/**
 * How strongly results lean toward where you are. Tuned by hand against real
 * searches from Atlanta: at these values "Sydney" → Sydney, Australia,
 * "starbucks" → the nearby ones, "10th Street" → the local street.
 */
const BIAS = { zoom: '12', location_bias_scale: '0.5' }

type PhotonProperties = {
  osm_type?: 'N' | 'W' | 'R'
  osm_id?: number
  osm_key?: string
  osm_value?: string
  /** house, street, city, district, county, state, country, other, … */
  type?: string
  name?: string
  housenumber?: string
  street?: string
  district?: string
  city?: string
  state?: string
  country?: string
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: PhotonProperties
}

function categoryOf({ osm_key: key = '', osm_value: value = '' }: PhotonProperties): PlaceCategory {
  if (['restaurant', 'fast_food', 'bar', 'pub', 'food_court'].includes(value)) return 'restaurant'
  if (value === 'cafe') return 'cafe'
  if (value === 'library') return 'library'
  if (value === 'parking') return 'parking'
  if (value === 'toilets') return 'restroom'
  if (key === 'shop') return 'store'
  if (key === 'railway' || key === 'public_transport' || value === 'bus_stop' || value === 'station') return 'transit'
  return 'other'
}

/** The line under the name: street for a place, region for a city. */
function addressOf(p: PhotonProperties) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const area = p.district ?? p.city
  const parts =
    p.type === 'city' || p.type === 'state' || p.type === 'country' || p.type === 'county'
      ? [p.state, p.country]
      : [street, area, p.country !== 'United States' ? p.country : p.state]
  return (
    parts
      .filter((x) => x && x !== p.name)
      .join(', ') || null
  )
}

function nameOf(p: PhotonProperties) {
  return p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.state || p.country || 'Unnamed place'
}

const UNKNOWN: Accessibility = {
  wheelchair: 'unknown',
  score: null,
  step_free_entrance: null,
  accessible_restroom: null,
  elevator: null,
  automatic_door: null,
  notes: null,
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

/**
 * `wheelchair=*` and friends for the places found, in one request. Best effort:
 * if it fails or is slow, results still show, just without the access badge.
 */
async function accessibilityFor(ids: string[]): Promise<Map<string, Accessibility>> {
  const found = new Map<string, Accessibility>()
  if (ids.length === 0) return found
  try {
    const res = await fetch(`${NOMINATIM_LOOKUP}?${new URLSearchParams({ osm_ids: ids.join(','), format: 'jsonv2', extratags: '1' })}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4_000),
    })
    if (!res.ok) return found
    const rows = (await res.json()) as { osm_type?: string; osm_id?: number; extratags?: Record<string, string> | null }[]
    for (const row of rows) {
      if (!row.osm_type || !row.osm_id || !row.extratags) continue
      found.set(`${row.osm_type[0].toUpperCase()}${row.osm_id}`, accessibilityOf(row.extratags))
    }
  } catch {
    // Badges are a nice-to-have here; the search itself already succeeded.
  }
  return found
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const q = params.get('q')?.trim()
  if (!q || q.length < 2) return ok<Place>([])

  const query = new URLSearchParams({ q, limit: '12', lang: 'en' })

  // Lean toward the middle of the box the app sends (around you, or the map).
  const bbox = params.get('bbox')
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
    if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
      query.set('lat', ((minLat + maxLat) / 2).toFixed(5))
      query.set('lon', ((minLng + maxLng) / 2).toFixed(5))
      query.set('zoom', BIAS.zoom)
      query.set('location_bias_scale', BIAS.location_bias_scale)
    }
  }

  try {
    const res = await fetch(`${PHOTON}?${query}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error('Search is unavailable right now. Try again in a moment.')
    const { features = [] } = (await res.json()) as { features?: PhotonFeature[] }

    // A long street is several OSM ways with one name; list it once.
    const seen = new Set<string>()
    const unique = features.filter((f) => {
      const p = f.properties
      const key = `${nameOf(p)}|${addressOf(p)}|${p.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Only actual places have a wheelchair tag worth asking about.
    const lookupIds = unique
      .map((f) => f.properties)
      .filter((p) => p.osm_type && p.osm_id && p.type === 'house')
      .map((p) => `${p.osm_type}${p.osm_id}`)
    const access = await accessibilityFor(lookupIds)

    const places: Place[] = unique.map((f) => {
      const p = f.properties
      const [lng, lat] = f.geometry.coordinates
      const osmRef = p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null
      return {
        id: osmRef ? `osm-${osmRef}` : `photon-${lat.toFixed(5)},${lng.toFixed(5)}`,
        name: nameOf(p),
        category: categoryOf(p),
        lat,
        lng,
        address: addressOf(p),
        accessibility: (osmRef && access.get(osmRef)) || UNKNOWN,
        features: [],
        updated_at: new Date().toISOString(),
      }
    })

    return ok(places)
  } catch (error) {
    return fail(error)
  }
}
