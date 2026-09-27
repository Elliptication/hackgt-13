import type { AccessFeature } from '@/types/features'

/**
 * The contract with the FastAPI backend. Field names are snake_case to match
 * Pydantic's default output, so neither side needs a transform layer.
 *
 * Keep this file and backend/schemas.py in sync by hand until the API is up,
 * then generate it:  npx openapi-typescript http://localhost:8000/openapi.json
 */

export type LatLng = { lat: number; lng: number }

/** Every list endpoint returns this, so adding pagination later breaks nothing. */
export type Paginated<T> = { items: T[]; total: number }

export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'library'
  | 'store'
  | 'restroom'
  | 'transit'
  | 'parking'
  | 'other'

/** Mirrors OSM's `wheelchair=*` tag so real map data maps straight in. */
export type WheelchairAccess = 'yes' | 'limited' | 'no' | 'unknown'

/**
 * `null` means "nobody has recorded this", which is NOT the same as `false`.
 * Telling a wheelchair user "no step-free entrance" when we simply don't know
 * is the worst failure this app can have — keep all three states to the UI.
 */
export type Accessibility = {
  wheelchair: WheelchairAccess
  /** 0–100 confidence, or null when unrated. */
  score: number | null
  step_free_entrance: boolean | null
  accessible_restroom: boolean | null
  elevator: boolean | null
  automatic_door: boolean | null
  notes: string | null
}

export type Place = {
  id: string
  name: string
  category: PlaceCategory
  lat: number
  lng: number
  address: string | null
  accessibility: Accessibility
  /** Point features at or near this place. */
  features: AccessFeature[]
  /** ISO 8601, UTC. */
  updated_at: string
}

export type PlacesQuery = {
  /** minLng,minLat,maxLng,maxLat — the WMS/GeoJSON order, not Overpass's. */
  bbox?: string
  category?: PlaceCategory[]
  wheelchair?: WheelchairAccess[]
  q?: string
  limit?: number
}
