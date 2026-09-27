/**
 * The seam. Components import from '@/lib/api' and nothing else.
 *
 * Every call is a real HTTP request against the FastAPI backend, using the
 * contract in types/. This app holds no data of its own: there is no bundled
 * dataset, no stand-in route handler and no OpenStreetMap access left in the
 * frontend. If the backend is down, the app says so rather than quietly
 * serving something stale.
 *
 * Configure it with one variable — see .env.example:
 *
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:6767
 *
 * What the backend must return is specified in API.md, and the TypeScript in
 * types/ is the contract — a response that drifts from it fails to compile.
 */

export type { AccessApi } from './client'
export { api, apiUrl, ApiError, API_BASE_URL, isBackendMissing, NO_BACKEND } from './client'
export type BboxQuery = { bbox?: string }
