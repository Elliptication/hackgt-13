import type { AccessFeature } from '@/types/features'
import type { KerbPoint, PathSegment } from '@/types/paths'
import type { Paginated, Place, PlacesQuery } from '@/types/places'
import type { RouteRequest, RouteResponse } from '@/types/routes'

/**
 * The only file that knows about URLs and fetch. Deliberately isomorphic —
 * plain fetch, no next/headers, no node-only imports — so a call can move
 * between a Server Component and a client hook without being rewritten.
 */

/**
 * Where the data comes from.
 *
 * Unset, this uses the stand-in handlers in app/api/v1/, so the app demos on
 * its own. Set it, and every request goes to the real backend instead — that is
 * the entire migration, and no component changes either way.
 *
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:6767
 *
 * See BACKEND.md for what the backend has to serve.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'

/**
 * Status 0 means the request never reached a server — no backend, wrong URL,
 * network down. The UI shows the API contract for this rather than an error,
 * because during the handover it is a normal state and the useful thing to put
 * on screen is what the backend still owes us.
 */
export const NO_BACKEND = 0

export function isBackendMissing(error: unknown) {
  return error instanceof ApiError && error.status === NO_BACKEND
}

/** Non-2xx responses, carrying FastAPI's `detail` string. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type PathsResponse = Paginated<PathSegment> & { kerbs: KerbPoint[] }

export interface AccessApi {
  /** Fast name search for a destination, anywhere in the world. */
  searchPlaces(query: string, bbox?: string): Promise<Paginated<Place>>
  getPlaces(query?: PlacesQuery): Promise<Paginated<Place>>
  getPlace(id: string): Promise<Place>
  getFeatures(query?: { bbox?: string }): Promise<Paginated<AccessFeature>>
  /** Sidewalks, crossings and steps, with the kerbs that make or break them. */
  getPaths(query?: { bbox?: string }): Promise<PathsResponse>
  getRoute(request: RouteRequest): Promise<RouteResponse>
}

function toSearchParams(query: Record<string, unknown> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    // FastAPI reads repeated keys as a list, so arrays go one param per item.
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)))
    else params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * A relative base URL cannot be fetched from the server, so resolve it against
 * the dev origin when there is no browser. Absolute URLs — the normal case now
 * that the backend is a separate service — pass straight through.
 */
function resolve(path: string) {
  const base = API_BASE_URL
  if (typeof window !== 'undefined' || /^https?:/.test(base)) return `${base}${path}`
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
  return `${origin}${base}${path}`
}

/** Validate at the boundary, so components past this line can trust their types. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(resolve(path), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch only rejects on network failure, never on a 4xx/5xx. The most
    // likely cause by far is that the backend simply is not started, so say so
    // rather than showing a generic failure.
    // Not framed as an error: during the handover an empty map usually means
    // the backend is not up yet, which is a normal state, not a fault.
    throw new ApiError(NO_BACKEND, `No response from ${API_BASE_URL}`)
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((body: { detail?: string }) => body.detail)
      .catch(() => null)
    throw new ApiError(res.status, detail ?? `Request failed with status ${res.status}`)
  }

  return res.json() as Promise<T>
}

/**
 * Build a URL against the configured API base. Exported for the tiled hooks,
 * which fetch per tile and so cannot go through the typed methods above — they
 * still must not hardcode a path, or pointing at FastAPI would miss them.
 */
export function apiUrl(path: string) {
  return resolve(path)
}

export const api: AccessApi = {
  searchPlaces: (query, bbox) => request<Paginated<Place>>(`/search${toSearchParams({ q: query, bbox })}`),

  getPlaces: (query) => request<Paginated<Place>>(`/places${toSearchParams(query)}`),

  getPlace: (id) => request<Place>(`/places/${encodeURIComponent(id)}`),

  getFeatures: (query) => request<Paginated<AccessFeature>>(`/features${toSearchParams(query)}`),

  getPaths: (query) => request<PathsResponse>(`/paths${toSearchParams(query)}`),

  getRoute: (body: RouteRequest) =>
    request<RouteResponse>('/routes', { method: 'POST', body: JSON.stringify(body) }),
}
