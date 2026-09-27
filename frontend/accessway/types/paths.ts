import type { LineString } from '@/types/routes'

/**
 * The pedestrian network, judged for wheelchair passability.
 *
 * This is what turns the app from "places that are accessible" into "routes you
 * can actually take" — a raised kerb or a flight of steps blocks a trip just as
 * surely as a step at the front door.
 */

export type PathAccess = 'yes' | 'limited' | 'no' | 'unknown'

export type PathKind = 'sidewalk' | 'crossing' | 'steps' | 'path'

export type PathSegment = {
  id: string
  kind: PathKind
  access: PathAccess
  geometry: LineString
  surface: string | null
  smoothness: string | null
  /** OSM `incline`: "up" / "down" / a percentage string. */
  incline: string | null
  width_m: number | null
  tactile_paving: boolean | null
  step_count: number | null
  /** Plain-language reason when access isn't `yes` — safe to show a user. */
  reason: string | null
}

/**
 * Kerbs make or break a crossing. `flush` and `lowered` are rollable; `raised`
 * is a wall to a wheelchair user even though the crossing looks fine on a map.
 */
export type KerbKind = 'flush' | 'lowered' | 'raised' | 'unknown'

export type KerbPoint = {
  id: string
  lat: number
  lng: number
  kerb: KerbKind
  access: PathAccess
  tactile_paving: boolean | null
}
