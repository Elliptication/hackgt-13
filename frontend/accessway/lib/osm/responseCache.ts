import 'server-only'

/**
 * Cache of finished API responses, keyed by endpoint and tile.
 *
 * The raw cache saves the download, but without this every request still
 * re-ran the transform over ~34,000 elements to produce the same ~100 rows —
 * about a second per request on an already-cached tile.
 */

type Entry<T> = { value: T; at: number }

const store = new Map<string, Entry<unknown>>()

const TTL_MS = 60 * 60 * 1000
const MAX_ENTRIES = 240

export function cachedResponse<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null

  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key)
    return null
  }

  return hit.value as T
}

export function cacheResponse<T>(key: string, value: T): T {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, at: Date.now() })
  return value
}
