/**
 * What the AccessWay API actually puts on the wire.
 *
 * Deliberately separate from `types/features.ts`: that file is the shape the
 * UI works in, this one is the shape the backend sends, and they are not the
 * same. `lib/api/accessway.ts` is the only place allowed to know both.
 *
 * Source of truth: backend/routers/ on the `backend` branch.
 */

/**
 * A feature as either features endpoint sends it.
 *
 * Two endpoints, two shapes, one type — because `GET /features` maps its rows
 * (`long` → `lng`, `verified` → `str(verified)`) while `GET /features/{id}`
 * returns `select('*')` untouched. The optional keys are the second spelling of
 * a field the first one renames; `toCommunityFeature` reads whichever arrived.
 */
export type BackendFeature = {
  id: number | string
  /** Whatever string the contributor sent. Not constrained server-side. */
  type: string
  name: string
  description?: string
  lat: number
  /** `GET /features` only — the renamed longitude. */
  lng?: number
  /** `GET /features/{id}` only — the raw column, before renaming. */
  long?: number
  /** `GET /features` only. Python's `str(verified)`: the text "True" or "False". */
  status?: string
  /** `GET /features/{id}` only — the raw column, an actual boolean. */
  verified?: boolean
  /**
   * `GET /features/{id}` only — PostGIS hex EWKB, e.g. `0101000020E6100000...`.
   *
   * The only place that endpoint carries a position: the `lat` and `long`
   * columns are never populated by `POST /contributions/`, which writes this
   * geometry instead. See lib/geo/wkb.ts.
   */
  location?: string | null
  /** `GET /features/{id}` only. Null until a name is stored at upload. */
  net_votes?: number | null
  total_votes?: number | null
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

/**
 * `GET /contributions/` — every photo row, unfiltered.
 *
 * The one read that returns `image_path`, which is what makes the photo
 * visible at all. It carries no coordinates, name, description or tally, so a
 * row is only useful joined to `/features` on `feature_id`.
 *
 * Takes no parameters — no bbox, no limit — so this is the whole table.
 */
export type ContributionRow = {
  id: number | string
  created_at: string
  /**
   * Google `sub` of the uploader. Null on rows not created through the upload
   * flow, which is the only thing that fills it in from the session.
   */
  user_id: string | null
  /** The join key back to `GET /features`. Null on an orphaned row. */
  feature_id: number | string | null
  /** Storage path inside the `contribution_images` bucket, never a URL. */
  image_path: string | null
}
