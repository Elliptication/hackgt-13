import { FEATURE_TYPES } from '@/data/FeatureTypes'
import type { BackendFeature, ContributionRef, UploadTicket } from '@/types/accessway'
import type { AccessFeature, FeatureType } from '@/types/features'

/**
 * The AccessWay backend: community features, photo contributions, and votes.
 *
 * This is a *second* seam, deliberately. `lib/api/client.ts` serves the map its
 * bulk data — places, the pedestrian network, routing — and that contract
 * (bbox in, `{ items, total }` out) is not what this service speaks. This one
 * takes a point and a radius, answers with a bare array, and owns the three
 * things the other cannot: what people have added, the photos behind it, and
 * whether the community believes them.
 *
 * Putting both behind one base URL would mean every caller guessing which half
 * it was talking to, so they stay separate and each is configured on its own:
 *
 *   NEXT_PUBLIC_ACCESSWAY_API_URL=https://api.accessway.tech
 *
 * Endpoints (backend/routers/ on the `backend` branch):
 *
 *   GET  /features?lat&long&radius                   → BackendFeature[]
 *   GET  /contributions/init?lat&lon&type&file_type  → UploadTicket
 *   POST /contributions/?lat&lon&type&path&secret    → the created rows
 *   GET  /contributions/by_feature/{feature_id}      → { contribution_id }
 *   POST /vote/?contribution_id&user_id&upvote       → the vote row
 */

export const ACCESSWAY_API_URL = (
  process.env.NEXT_PUBLIC_ACCESSWAY_API_URL ?? 'https://api.accessway.tech'
).replace(/\/+$/, '')

/**
 * Where contribution photos end up. The API hands back a storage *path*, never
 * a URL, so the bucket has to be named here to turn one into the other. Unset,
 * uploads still work — the photo just cannot be read back from the server.
 */
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
const BUCKET = 'contribution_images'

/** Nothing answered: wrong host, service down, no network. */
export const UNREACHABLE = 0

/**
 * Something answered, but not this API. The host currently serves a placeholder
 * worker that returns "Hello world" with a 200 to every path, so this is the
 * state to expect until the real worker is deployed — and an uptime check alone
 * would call it healthy.
 */
export const NOT_THE_API = -1

export class AccesswayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AccesswayError'
  }
}

/** The request ran out of time. A cold Python Worker is seconds, not milliseconds. */
export const TIMED_OUT = -2

/** True when the service itself is the problem, rather than the request. */
export function isBackendDown(error: unknown) {
  return (
    error instanceof AccesswayError &&
    (error.status === UNREACHABLE || error.status === NOT_THE_API || error.status === TIMED_OUT)
  )
}

/**
 * How long to wait, by what is being done.
 *
 * A Cloudflare Python Worker cold-starts in seconds, so these are generous for
 * a first call and still short enough that a hung service does not take the map
 * with it. Without them a stalled connection hangs until the browser gives up,
 * which on mobile can be minutes of a spinner.
 */
const BUDGET_MS = { read: 12_000, write: 20_000, upload: 90_000 }

/** Worth trying again: the service is starting, restarting, or shedding load. */
const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * Retries, but only where repeating the call cannot do damage.
 *
 * Reads are safe by definition. A vote is safe because the backend treats a
 * repeat of the same vote as a no-op — that is in `routers/vote.py`, not an
 * assumption. Creating a contribution is *not* safe: it inserts a row, so a
 * retry after a timeout that actually succeeded would duplicate the feature.
 */
const ATTEMPTS = { idempotent: 3, once: 1 }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Backoff with jitter. Fixed delays from every open tab arrive together and
 * hit a recovering service as one spike.
 */
function backoffMs(attempt: number) {
  return 300 * 2 ** (attempt - 1) * (0.7 + Math.random() * 0.6)
}

/** A timeout the caller's own abort still wins over. */
function withDeadline(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms)

  const relay = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) relay()
    else signal.addEventListener('abort', relay, { once: true })
  }

  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', relay)
    },
  }
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    search.set(key, String(value))
  }
  return search.toString()
}

type Call = {
  /** Wall-clock budget for one attempt. */
  budgetMs?: number
  /** How many attempts in total. One means no retry. */
  attempts?: number
  signal?: AbortSignal
} & RequestInit

/**
 * Every call goes through here, and every call reads the body as text first.
 *
 * Parsing straight to JSON would turn the placeholder worker's "Hello world"
 * into an unexplained syntax error at byte 1. Reading the text means we can say
 * what actually came back instead.
 */
async function request<T>(path: string, call: Call = {}): Promise<T> {
  const { budgetMs = BUDGET_MS.read, attempts = ATTEMPTS.idempotent, signal, ...init } = call
  const url = `${ACCESSWAY_API_URL}${path}`

  let last: AccesswayError = new AccesswayError(UNREACHABLE, `No response from ${ACCESSWAY_API_URL}`)

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // The caller giving up is not a failure to report or retry.
    if (signal?.aborted) throw new AccesswayError(UNREACHABLE, 'Cancelled')

    const deadline = withDeadline(signal, budgetMs)
    try {
      const res = await fetch(url, { ...init, signal: deadline.signal })
      const body = await res.text()

      if (!res.ok) {
        // FastAPI puts the reason in `detail`; anything else came from a proxy.
        const detail = parse<{ detail?: string }>(body)?.detail
        last = new AccesswayError(res.status, detail ?? `Request failed with status ${res.status}`)
        if (!TRANSIENT.has(res.status)) throw last
      } else {
        const parsed = parse<T>(body)
        if (parsed !== null) return parsed
        // Answered, but not with JSON. Not transient — retrying a placeholder
        // worker just spends the budget three times over.
        throw new AccesswayError(
          NOT_THE_API,
          `${ACCESSWAY_API_URL} is up but not serving the API — ${path} answered with ${body.slice(0, 40)}`,
        )
      }
    } catch (err) {
      if (err instanceof AccesswayError) throw err
      if (signal?.aborted) throw new AccesswayError(UNREACHABLE, 'Cancelled')
      last =
        err instanceof Error && err.name === 'TimeoutError'
          ? new AccesswayError(TIMED_OUT, `${ACCESSWAY_API_URL} did not answer within ${budgetMs / 1000}s.`)
          : new AccesswayError(UNREACHABLE, `No response from ${ACCESSWAY_API_URL}`)
    } finally {
      deadline.done()
    }

    if (attempt < attempts) await wait(backoffMs(attempt))
  }

  throw last
}

function parse<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T
  } catch {
    return null
  }
}

/** The radius is in miles, so callers holding metres have one place to convert. */
export const METRES_PER_MILE = 1609.344

/** The map's own feature shape, plus what only this service knows about one. */
export type CommunityFeature = AccessFeature & {
  /** Past the vote threshold, so it belongs on the map rather than in review. */
  verified: boolean
  /** What a vote is cast against. Null means the row was never finished. */
  contributionId: string | null
  /** The backend's own id, before we prefix it. */
  featureId: string
}

const KNOWN_TYPES = Object.keys(FEATURE_TYPES) as FeatureType[]

/** The API does not constrain `type`, so anything unrecognised lands in "other". */
function toFeatureType(value: string): FeatureType {
  const normalised = value?.trim().toLowerCase()
  return KNOWN_TYPES.find((t) => t === normalised) ?? 'other'
}

/**
 * The API names a feature after its type ("ramp") and leaves the description
 * empty, because neither is collected at upload. Rather than print a bare
 * lowercase word in the sidebar, borrow the label the legend already uses.
 */
function toCommunityFeature(raw: BackendFeature): CommunityFeature {
  const type = toFeatureType(raw.type)
  const name = raw.name?.trim()

  return {
    // Prefixed so it cannot collide with an id from the OSM-backed endpoints.
    id: `community-${raw.id}`,
    featureId: String(raw.id),
    type,
    name: !name || name === raw.type ? FEATURE_TYPES[type].label : name,
    description: raw.description?.trim() || undefined,
    lat: raw.lat,
    lng: raw.lng,
    status: 'working',
    verified: String(raw.status).toLowerCase() === 'true',
    contributionId: raw.contribution_id === null ? null : String(raw.contribution_id),
  }
}

/** The public URL of a contribution photo, if the bucket is configured and public. */
export function contributionPhotoUrl(path: string | null | undefined) {
  if (!path || !SUPABASE_URL) return undefined
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.replace(/^\/+/, '')}`
}

/**
 * `POST /contributions/` echoes Supabase's own insert responses back, rather
 * than a shape of its own, so the ids have to be dug out of `data[0]`. Typed
 * loosely on purpose: this is somebody else's envelope and it may change.
 */
type InsertEcho = { data?: Array<Record<string, unknown>> } | null | undefined
type CreateContributionResponse = { feature?: InsertEcho; contribution?: InsertEcho }

/** What a finished upload is worth remembering: the rows it created. */
export type CreatedContribution = {
  featureId: string | null
  /** What votes are cast against. Null if the echo did not carry it. */
  contributionId: string | null
}

function idIn(echo: InsertEcho) {
  const id = echo?.data?.[0]?.id
  return id === undefined || id === null ? null : String(id)
}

export const accessway = {
  /**
   * Everything the community has added within `radiusMiles` of a point.
   *
   * Miles, not metres: the backend turns the radius into degrees by dividing by
   * 69, which is only true for miles.
   */
  async getFeatures(
    { lat, lng, radiusMiles }: { lat: number; lng: number; radiusMiles: number },
    signal?: AbortSignal,
  ): Promise<CommunityFeature[]> {
    const raw = await request<BackendFeature[]>(`/features?${query({ lat, long: lng, radius: radiusMiles })}`, {
      signal,
      budgetMs: BUDGET_MS.read,
    })
    // An object where a list belongs means the shape changed upstream. Treating
    // that as "nothing here" would quietly empty the map, so it is an error.
    if (!Array.isArray(raw)) throw new AccesswayError(NOT_THE_API, '/features did not return a list.')
    return raw.map(toCommunityFeature)
  },

  /** Step 1 of an upload: a signed URL to put the photo, and the token to claim it. */
  initContribution({
    lat,
    lng,
    type,
    fileType,
  }: {
    lat: number
    lng: number
    type: FeatureType
    fileType: string
  }) {
    // Retrying only costs another signed URL, so this one is safe to repeat.
    return request<UploadTicket>(`/contributions/init?${query({ lat, lon: lng, type, file_type: fileType })}`, {
      budgetMs: BUDGET_MS.write,
    })
  },

  /**
   * Step 2: the photo itself, straight to Supabase storage rather than through
   * the API — the signed URL exists precisely so the image never touches it.
   */
  async uploadPhoto(ticket: UploadTicket, file: File) {
    // supabase-py has returned both an absolute URL and a storage-relative one
    // across versions, so accept either.
    const url = /^https?:/.test(ticket.signed_url)
      ? ticket.signed_url
      : `${SUPABASE_URL}/storage/v1${ticket.signed_url.startsWith('/') ? '' : '/'}${ticket.signed_url}`

    if (!/^https?:/.test(url)) {
      throw new AccesswayError(
        NOT_THE_API,
        'The upload URL is relative and NEXT_PUBLIC_SUPABASE_URL is unset, so there is nowhere to send the photo.',
      )
    }

    // Photos are up to 10 MB over whatever connection someone is standing in,
    // so this gets the long budget. The path is fixed by the ticket, so a
    // second attempt overwrites rather than duplicating.
    let last: AccesswayError | null = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      const deadline = withDeadline(undefined, BUDGET_MS.upload)
      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
          signal: deadline.signal,
        })
        if (res.ok) return
        last = new AccesswayError(res.status, `The photo upload was rejected (${res.status}).`)
        // A rejected token or a file too large will be rejected again.
        if (!TRANSIENT.has(res.status)) throw last
      } catch (err) {
        if (err instanceof AccesswayError) throw err
        last =
          err instanceof Error && err.name === 'TimeoutError'
            ? new AccesswayError(TIMED_OUT, 'The photo took too long to upload.')
            : new AccesswayError(UNREACHABLE, 'Could not reach the photo store.')
      } finally {
        deadline.done()
      }

      if (attempt === 1) await wait(backoffMs(attempt))
    }

    throw last ?? new AccesswayError(UNREACHABLE, 'Could not reach the photo store.')
  },

  /** Step 3: claim the uploaded path, which creates the feature and its contribution. */
  async createContribution({
    lat,
    lng,
    type,
    path,
    secret,
  }: {
    lat: number
    lng: number
    type: FeatureType
    path: string
    secret: string
  }): Promise<CreatedContribution> {
    const created = await request<CreateContributionResponse>(
      `/contributions/?${query({ lat, lon: lng, type, path, secret })}`,
      // Never retried: this inserts rows, so a repeat after a timeout that
      // actually landed would put the same ramp on the map twice.
      { method: 'POST', budgetMs: BUDGET_MS.write, attempts: ATTEMPTS.once },
    )
    return { featureId: idIn(created.feature), contributionId: idIn(created.contribution) }
  },

  /** What to vote on, given a feature id from `/features`. */
  async contributionIdFor(featureId: string) {
    const { contribution_id } = await request<ContributionRef>(
      `/contributions/by_feature/${encodeURIComponent(featureId)}`,
    )
    return contribution_id
  },

  /**
   * Confirm or reject someone's photo. Voting the same way twice is a no-op
   * server-side and voting the other way flips it, so the caller does not have
   * to track what it already sent.
   */
  vote({ contributionId, userId, upvote }: { contributionId: string; userId: string; upvote: boolean }) {
    return request<unknown>(`/vote/?${query({ contribution_id: contributionId, user_id: userId, upvote })}`, {
      method: 'POST',
      budgetMs: BUDGET_MS.write,
    })
  },
}

/**
 * The whole upload, as one call: sign, put, claim.
 *
 * Kept here rather than in the form because the three steps are only correct
 * together — the secret is bound to the lat, lon and type it was issued for, so
 * a caller that changed any of them in between gets a 401 and no explanation.
 */
export async function contributePhoto({
  file,
  lat,
  lng,
  type,
}: {
  file: File
  lat: number
  lng: number
  type: FeatureType
}): Promise<CreatedContribution & { path: string }> {
  const ticket = await accessway.initContribution({ lat, lng, type, fileType: extensionOf(file) })
  await accessway.uploadPhoto(ticket, file)
  const created = await accessway.createContribution({
    lat,
    lng,
    type,
    path: ticket.path,
    secret: ticket.secret,
  })

  // The create echoes Supabase's insert responses, which may or may not carry
  // the contribution id. There is an endpoint for exactly this, so ask it
  // rather than returning a photo nobody can vote on.
  let contributionId = created.contributionId
  if (!contributionId && created.featureId) {
    contributionId = await accessway.contributionIdFor(created.featureId).catch(() => null)
  }

  return { ...created, contributionId, path: ticket.path }
}

/** ".jpg" — the API stores the file under this suffix, and wants the dot. */
function extensionOf(file: File) {
  const fromName = file.name.match(/\.[a-z0-9]+$/i)?.[0]
  if (fromName) return fromName.toLowerCase()
  const fromMime = file.type.split('/')[1]
  return fromMime ? `.${fromMime.toLowerCase()}` : '.jpg'
}
