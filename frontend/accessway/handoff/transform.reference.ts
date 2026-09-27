/*
 * REFERENCE ONLY - not compiled into the app.
 *
 * OpenStreetMap tag translation. Which tags mean a lift, how wheelchair=yes
 * becomes an entrance with no stairs, the four-state access model, how paths
 * are judged passable, and how unnamed features are named after the nearest
 * landmark. Tested against real data.
 *
 * Port it to Python, then delete this file.
 */


import type { AccessFeature, FeatureType } from '@/types/features'
import type { KerbPoint, PathAccess, PathSegment } from '@/types/paths'
import type { Accessibility, Place, PlaceCategory, WheelchairAccess } from '@/types/places'

import { coordsOf, type OsmElement } from './types'

/**
 * OpenStreetMap tags → our types.
 *
 * On wording: we never label anything "blocked" or "inaccessible". Those are
 * verdicts, and they tell you nothing you can act on. We name the actual thing
 * in the way - "8 stairs, and no ramp beside them" - because that is what a person
 * needs in order to decide.
 */

const ROUGH_SURFACES = new Set(['gravel', 'fine_gravel', 'dirt', 'ground', 'grass', 'sand', 'sett', 'cobblestone', 'stepping_stones', 'mud', 'unpaved'])
const BAD_SMOOTHNESS = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'])

const triState = (v?: string) => (v === 'yes' || v === 'designated' ? true : v === 'no' ? false : null)
const nullable = (v?: string) => v ?? null

function num(v?: string) {
  const n = Number.parseFloat(v ?? '')
  return Number.isFinite(n) ? n : null
}

export function wheelchairOf(tags: Record<string, string>): WheelchairAccess {
  const v = tags.wheelchair
  return v === 'yes' || v === 'limited' || v === 'no' ? v : 'unknown'
}

/* --------------------------------------------------------------- places */

export function categoryOf(tags: Record<string, string>): PlaceCategory {
  const { amenity, shop, railway, public_transport } = tags
  if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'pub') return 'restaurant'
  if (amenity === 'cafe' || shop === 'coffee') return 'cafe'
  if (amenity === 'library') return 'library'
  if (amenity === 'parking') return 'parking'
  if (amenity === 'toilets') return 'restroom'
  if (public_transport || railway === 'station' || amenity === 'bus_station') return 'transit'
  if (shop) return 'store'
  return 'other'
}

/** 0–100, or null when we genuinely have nothing to go on. Never guess. */
function scoreOf(tags: Record<string, string>) {
  const wheelchair = wheelchairOf(tags)
  if (wheelchair === 'unknown') return null
  let score = wheelchair === 'yes' ? 80 : wheelchair === 'limited' ? 50 : 10
  if (triState(tags['toilets:wheelchair'])) score += 10
  if (triState(tags.automatic_door)) score += 10
  return Math.min(score, 100)
}

function accessibilityOf(tags: Record<string, string>): Accessibility {
  return {
    wheelchair: wheelchairOf(tags),
    score: scoreOf(tags),
    step_free_entrance: triState(tags.wheelchair),
    accessible_restroom: triState(tags['toilets:wheelchair']),
    elevator: null,
    automatic_door: triState(tags.automatic_door),
    notes: nullable(tags['wheelchair:description']),
  }
}

export function toPlace(el: OsmElement): Place | null {
  const tags = el.tags
  const at = coordsOf(el)
  if (!tags?.name || !at) return null

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')

  return {
    id: `osm-${el.type}-${el.id}`,
    name: tags.name,
    category: categoryOf(tags),
    ...at,
    address: [street, tags['addr:city']].filter(Boolean).join(', ') || null,
    accessibility: accessibilityOf(tags),
    features: [],
    updated_at: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------- features */

export function featureTypeOf(tags: Record<string, string>): FeatureType | null {
  if (tags.highway === 'elevator' || tags.elevator === 'yes') return 'elevator'
  if (tags.amenity === 'toilets' || tags['toilets:wheelchair'] === 'yes') return 'restroom'
  if (tags.ramp === 'yes' || tags['ramp:wheelchair'] === 'yes') return 'ramp'
  if (tags.entrance || tags.automatic_door === 'yes') return 'entrance'
  // A venue tagged wheelchair=yes means you can get in without steps. That is
  // an accessible entrance, not an "Other" - the generic bucket told a user
  // nothing and made up two thirds of every result.
  if (tags.wheelchair === 'yes' || tags.wheelchair === 'designated' || tags.wheelchair === 'limited') {
    return 'entrance'
  }
  return null
}

export function toFeature(el: OsmElement, type: FeatureType): AccessFeature | null {
  const tags = el.tags ?? {}
  const at = coordsOf(el)
  if (!at) return null

  // Detail beats a bare label: "Elevator - levels 1-4, door 90cm" tells someone
  // whether it is usable; "Elevator" does not.
  const detail = [
    tags['wheelchair:description'],
    tags.description,
    tags.level && `Levels ${tags.level.replace(/;/g, ', ')}`,
    tags['door:width'] && `Door ${tags['door:width']} wide`,
    tags.automatic_door === 'yes' && 'Automatic door',
    tags.door === 'manual' && 'Manual door',
    tags['toilets:wheelchair'] === 'yes' && 'Accessible cubicle',
    tags.operator,
  ].filter(Boolean) as string[]

  return {
    id: `osm-${el.type}-${el.id}`,
    type,
    name: tags.name ?? '',
    description: detail.length ? detail.join(' · ') : undefined,
    ...at,
    status: wheelchairOf(tags) === 'no' ? 'reported-issue' : 'working',
  }
}

/**
 * OSM rarely names a doorway or a lift, which would leave a list reading
 * "Elevator" nineteen times. Name each one after the nearest landmark instead.
 */
export function nameByNearest(features: AccessFeature[], elements: OsmElement[]) {
  const NOUN: Record<FeatureType, string> = {
    elevator: 'Elevator',
    restroom: 'Accessible restroom',
    entrance: 'Entrance with no stairs',
    ramp: 'Ramp',
    other: 'No stairs',
  }

  const anchors = elements
    .filter((el) => el.tags?.name && coordsOf(el))
    .map((el) => ({ name: el.tags!.name, ...coordsOf(el)! }))

  for (const feature of features) {
    if (feature.name) continue
    let closest: (typeof anchors)[number] | null = null
    let best = Infinity
    for (const a of anchors) {
      const d = (a.lat - feature.lat) ** 2 + (a.lng - feature.lng) ** 2
      if (d < best) [best, closest] = [d, a]
    }
    // ~130 m; beyond that the landmark stops being a useful description.
    feature.name = closest && best < 0.0012 ** 2 ? `${NOUN[feature.type]} at ${closest.name}` : NOUN[feature.type]
  }
  return features
}

/* ---------------------------------------------------------------- paths */

function kindOf(tags: Record<string, string>): PathSegment['kind'] {
  if (tags.highway === 'steps') return 'steps'
  if (tags.footway === 'crossing' || tags.highway === 'crossing') return 'crossing'
  if (tags.footway === 'sidewalk') return 'sidewalk'
  return 'path'
}

/**
 * Judge a segment, and say what's actually there in plain words. A surveyor's
 * explicit tag always beats our inference.
 */
function judge(tags: Record<string, string>, kind: PathSegment['kind']): [PathAccess, string | null] {
  if (tags.wheelchair === 'no') return ['no', 'Marked as not wheelchair accessible']
  if (tags.wheelchair === 'yes') return ['yes', null]
  if (tags.wheelchair === 'limited') return ['limited', 'Tight or awkward in places']

  if (kind === 'steps') {
    if (tags['ramp:wheelchair'] === 'yes') return ['limited', 'Stairs, but there is a ramp alongside']
    const count = tags.step_count ? `${tags.step_count} stairs` : 'Stairs'
    return ['no', `${count}, and no ramp beside them`]
  }

  if (BAD_SMOOTHNESS.has(tags.smoothness)) return ['limited', 'Broken or uneven surface']
  if (ROUGH_SURFACES.has(tags.surface)) return ['limited', `${tags.surface.replace(/_/g, ' ')} underfoot`]

  const width = num(tags.width)
  if (width !== null && width < 0.9) return ['limited', `Narrow — ${width} m across`]

  if (tags.surface) return ['yes', null]
  return ['unknown', null]
}

export function toPath(el: OsmElement): PathSegment | null {
  if (!el.geometry || el.geometry.length < 2) return null
  const tags = el.tags ?? {}
  const kind = kindOf(tags)
  const [access, reason] = judge(tags, kind)

  return {
    id: `osm-way-${el.id}`,
    kind,
    access,
    geometry: { type: 'LineString', coordinates: el.geometry.map((p) => [p.lon, p.lat]) },
    surface: nullable(tags.surface),
    smoothness: nullable(tags.smoothness),
    incline: nullable(tags.incline),
    width_m: num(tags.width),
    tactile_paving: triState(tags.tactile_paving),
    step_count: tags.step_count ? Number.parseInt(tags.step_count, 10) : null,
    reason,
  }
}

export function toKerb(el: OsmElement): KerbPoint | null {
  const tags = el.tags ?? {}
  const at = coordsOf(el)
  if (!at) return null

  const kerb = (['flush', 'lowered', 'raised'] as const).find((k) => k === tags.kerb) ?? 'unknown'
  if (kerb === 'unknown' && tags.highway === 'crossing' && !tags.tactile_paving) return null

  return {
    id: `osm-node-${el.id}`,
    ...at,
    kerb,
    access: kerb === 'flush' || kerb === 'lowered' ? 'yes' : kerb === 'raised' ? 'no' : 'unknown',
    tactile_paving: triState(tags.tactile_paving),
  }
}
