/**
 * What the AccessWay API actually puts on the wire.
 *
 * Deliberately separate from `types/features.ts`: that file is the shape the
 * UI works in, this one is the shape the backend sends, and they are not the
 * same. `lib/api/accessway.ts` is the only place allowed to know both.
 *
 * Source of truth: backend/routers/ on the `backend` branch.
 */

/** `GET /features?lat&long&radius` — a bare array, not a paginated envelope. */
export type BackendFeature = {
  id: number | string
  /** Whatever string the contributor sent. Not constrained server-side. */
  type: string
  name: string
  description: string
  lat: number
  lng: number
  /** Python's `str(verified)`, so the literal text "True" or "False". */
  status: string
  contribution_id: string | number | null
}

/** `GET /contributions/init` — a Supabase signed upload URL, and the token that unlocks the POST. */
export type UploadTicket = {
  secret: string
  signed_url: string
  path: string
}

/** `GET /contributions/by_feature/{id}` */
export type ContributionRef = {
  contribution_id: string
}
