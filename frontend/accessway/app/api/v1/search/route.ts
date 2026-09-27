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

/**
 * Looks like a street address or a street: starts with a house number
 * ("800 Peachtree St NE", "30332") or ends in a street word ("10th St NW").
 *
 * Photon is weak at these in the US — OpenStreetMap has few US house numbers,
 * so a named bus stop or car park that mentions the street outranks the
 * address itself. Nominatim interpolates house numbers along streets from US
 * census data, so these go to it as well, and its answers go first.
 */
const ADDRESSY =
  /^\d+[a-z]?\b|\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|way|pkwy|parkway|hwy|highway|ct|court|pl|place|cir|circle|ter|terrace|nw|ne|sw|se)\.?$/i

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'

/**
 * Stops and platforms are named after the streets they sit on ("10th St NW at
 * Pennsylvania Ave"), so a street search anywhere turned up pages of them.
 * Nobody plans a trip to a bus stop pole by typing its street.
 */
const PHOTON_EXCLUDE = ['!highway:bus_stop', '!public_transport:platform', '!public_transport:stop_position']

/** With a local address match in hand, Photon results further than this are noise. */
const FAR_KM = 50

type NominatimResult = {
  osm_type?: 'node' | 'way' | 'relation'
  osm_id?: number
  lat: string
  lon: string
  name?: string
  category?: string
  type?: string
  address?: Record<string, string>
  extratags?: Record<string, string> | null
}

function nominatimPlace(r: NominatimResult): Place {
  const a = r.address ?? {}
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const area = a.neighbourhood ?? a.suburb ?? a.quarter
  const city = a.city ?? a.town ?? a.village ?? a.hamlet
  const region = a.country_code === 'us' ? a.state : a.country
  const name = r.name || street || a.road || city || 'Unnamed place'
  const address = [name === street ? area : street, city, region].filter((x) => x && x !== name).join(', ') || null
  const ref = r.osm_type && r.osm_id ? `${r.osm_type[0].toUpperCase()}${r.osm_id}` : null
  const lat = Number(r.lat)
  const lng = Number(r.lon)

  return {
    id: ref ? `osm-${ref}` : `nominatim-${lat.toFixed(5)},${lng.toFixed(5)}`,
    name,
    category: categoryOf({ osm_key: r.category, osm_value: r.type }),
    lat,
    lng,
    address,
    accessibility: r.extratags ? accessibilityOf(r.extratags) : UNKNOWN,
    features: [],
    updated_at: new Date().toISOString(),
  }
}

/**
 * Nominatim allows one request a second and quietly refuses more. Typing fires
 * a search at every pause, which was enough to trip it — so an address that
 * resolved on its own came back empty mid-sentence. Calls are spaced out here,
 * and one that would have to wait too long is skipped rather than queued.
 */
let nominatimFreeAt = 0
const NOMINATIM_GAP_MS = 1_100
const NOMINATIM_MAX_WAIT_MS = 1_500

async function nominatimSlot() {
  const now = Date.now()
  const wait = nominatimFreeAt - now
  if (wait > NOMINATIM_MAX_WAIT_MS) return false
  nominatimFreeAt = Math.max(now, nominatimFreeAt) + NOMINATIM_GAP_MS
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  return true
}

/** Best effort: if Nominatim is slow or refuses, Photon's answer still stands. */
async function searchNominatim(q: string, centre: { lat: number; lng: number } | null): Promise<Place[]> {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '1', extratags: '1' })
  // A preference, not a fence: an address in another city is still found.
  if (centre) {
    params.set(
      'viewbox',
      [centre.lng - 0.1, centre.lat - 0.1, centre.lng + 0.1, centre.lat + 0.1].map((n) => n.toFixed(4)).join(','),
    )
  }
  try {
    if (!(await nominatimSlot())) return []
    const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return []
    const rows = (await res.json()) as NominatimResult[]
    return Array.isArray(rows) ? rows.map(nominatimPlace) : []
  } catch {
    return []
  }
}

async function searchPhoton(q: string, centre: { lat: number; lng: number } | null): Promise<Place[]> {
  const query = new URLSearchParams({ q, limit: '12', lang: 'en' })
  for (const tag of PHOTON_EXCLUDE) query.append('osm_tag', tag)
  // Lean toward the middle of the box the app sends (around you, or the map).
  if (centre) {
    query.set('lat', centre.lat.toFixed(5))
    query.set('lon', centre.lng.toFixed(5))
    query.set('zoom', BIAS.zoom)
    query.set('location_bias_scale', BIAS.location_bias_scale)
  }

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

  return unique.map((f) => {
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
}

const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'

type CensusMatch = {
  matchedAddress: string
  coordinates: { x: number; y: number }
  tigerLine?: { tigerLineId?: string; side?: string }
}

/**
 * The US Census geocoder: house numbers for practically every US street,
 * including the homes OpenStreetMap has never heard of. Free, no key.
 *
 * It wants a whole address with a city or zip ("123 Oak St, Decatur GA") and
 * does not autocomplete, so it is only asked once the query has a number and
 * enough words to be one.
 */
async function searchCensus(q: string): Promise<Place[]> {
  if (!/^\d+[a-z]?\s+\S+\s+\S+/i.test(q)) return []
  const params = new URLSearchParams({ address: q, benchmark: 'Public_AR_Current', format: 'json' })
  try {
    const res = await fetch(`${CENSUS}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } }
    return (body.result?.addressMatches ?? []).slice(0, 3).map((m) => {
      // "800 PEACHTREE ST NE, ATLANTA, GA, 30308" → street first, the rest under it.
      const [street, ...rest] = m.matchedAddress.split(', ').map(titleCase)
      const lat = m.coordinates.y
      const lng = m.coordinates.x
      return {
        id: `census-${lat.toFixed(5)},${lng.toFixed(5)}`,
        name: street,
        category: 'other' as const,
        lat,
        lng,
        address: rest.join(', ').replace(/\b([A-Z][a-z])\b(?=,|$)/, (s) => s.toUpperCase()) || null,
        accessibility: UNKNOWN,
        features: [],
        updated_at: new Date().toISOString(),
      }
    })
  } catch {
    return []
  }
}

/** "PEACHTREE ST NE" → "Peachtree St NE"; compass points and state codes stay capitals. */
function titleCase(text: string) {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Nw|Ne|Sw|Se|N|S|E|W)\b/g, (d) => d.toUpperCase())
}

/**
 * A house number nobody could place, on a street somebody could.
 *
 * Better than nothing for getting somewhere — the street is right, the exact
 * spot on it is not — so it says so rather than passing for the address.
 */
function approximateAddress(q: string, found: Place[]): Place | null {
  const number = q.match(/^(\d+[a-z]?)\s/i)?.[1]
  if (!number) return null
  if (found.some((p) => p.name.startsWith(`${number} `))) return null
  // A street, not a shop that happens to be on one.
  const street = found.find((p) =>
    /\b(street|road|avenue|drive|lane|way|boulevard|parkway|court|place|circle|terrace|trail|highway|pike|run|row)\b/i.test(p.name),
  )
  if (!street) return null
  return {
    ...street,
    id: `approx-${number}-${street.id}`,
    name: `${number} ${street.name}`,
    address: ['Approximate: somewhere on this street', street.address].filter(Boolean).join(' · '),
  }
}

/** Rough great-circle distance, good enough to tell "this city" from "another state". */
function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return Math.sqrt(x * x + y * y) * 6371
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const q = params.get('q')?.trim()
  if (!q || q.length < 2) return ok<Place>([])

  let centre: { lat: number; lng: number } | null = null
  const bbox = params.get('bbox')
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number)
    if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
      centre = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
    }
  }

  const addressy = ADDRESSY.test(q)

  try {
    // Both at once for an address, so asking a second service adds no wait.
    const [exact, nominatim, photon] = await Promise.all([
      addressy ? searchCensus(q) : Promise.resolve([]),
      addressy ? searchNominatim(q, centre) : Promise.resolve([]),
      searchPhoton(q, centre).catch((err: unknown) => {
        // Photon down is only fatal when there is nothing else to show.
        if (!addressy) throw err
        return [] as Place[]
      }),
    ])

    // Exact house matches first, then Nominatim's, then — if all anyone could
    // find was the street — that street with the number on it, marked approximate.
    // The Census geocoder has no sense of "near": without a city in the query,
    // "742 Evergreen Ter" gave a house in Idaho first. Far matches go last.
    const near = (p: Place) => !centre || kmBetween(centre, p) <= FAR_KM
    const exactNear = exact.filter(near)
    const exactFar = exact.filter((p) => !near(p))
    const approx = exactNear.length === 0 ? approximateAddress(q, nominatim.filter(near)) : null
    const addresses = [...(approx ? [approx] : []), ...exactNear, ...nominatim, ...exactFar]

    // Address matches first. Once one is local, far-off Photon hits for the
    // same words (a 10th St NW in another city) only get in the way.
    const localMatch = centre && addresses.some((p) => kmBetween(centre, p) <= FAR_KM)
    const rest = localMatch ? photon.filter((p) => kmBetween(centre!, p) <= FAR_KM) : photon

    const seen = new Set<string>()
    const places = [...addresses, ...rest].filter((p) => {
      // The same building from both services, or one street split into segments.
      const key = `${p.name}|${p.address}`
      if (seen.has(p.id) || seen.has(key)) return false
      seen.add(p.id)
      seen.add(key)
      return true
    })

    return ok(places.slice(0, 12))
  } catch (error) {
    return fail(error)
  }
}
