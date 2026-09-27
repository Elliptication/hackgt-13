import type { LatLng } from '@/types/places'

/** Things a wheelchair route may need to avoid. */
export type RouteHazard = 'stairs' | 'steep' | 'unpaved' | 'construction' | 'no_curb_cut'

export type RouteRequest = {
  from: LatLng
  to: LatLng
  avoid: RouteHazard[]
  /** Percent grade ceiling; 8 is roughly the ADA limit for a ramp run. */
  max_incline_pct: number | null
}

/**
 * GeoJSON LineString. Coordinates are [lng, lat] — spec order, the reverse of
 * Leaflet's. Hand this straight to react-leaflet's <GeoJSON> rather than
 * flipping pairs by hand; that swap is the classic route-in-the-ocean bug.
 */
export type LineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export type RouteStep = {
  instruction: string
  distance_m: number
  duration_s: number
  /** Where this step begins, for highlighting it on the map. */
  location: LatLng
  surface: string | null
  incline_pct: number | null
  /** Non-null means render a warning against this step. */
  hazard: RouteHazard | null
}

export type Route = {
  id: string
  distance_m: number
  duration_s: number
  geometry: LineString
  steps: RouteStep[]
  step_free: boolean
  max_incline_pct: number | null
  accessibility_score: number | null
  /** Human-readable, shown above the step list. */
  warnings: string[]
}

/** `routes[0]` is the recommended one. */
export type RouteResponse = { routes: Route[] }
