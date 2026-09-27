import 'server-only'

import type { OsmElement } from './types'

/**
 * Caches the raw OpenStreetMap payload per area, so /features, /paths and
 * /places share one download when a tile is first seen. The finished responses
 * are cached separately — see responseCache.ts.
 */

type Entry = { elements: OsmElement[]; at: number }

const store = new Map<string, Entry>()

const FRESH_MS = 60 * 60 * 1000
const FALLBACK_MS = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 60

export function readCache(key: string): { elements: OsmElement[]; stale: boolean } | null {
  const hit = store.get(key)
  if (!hit) return null

  const age = Date.now() - hit.at
  if (age > FALLBACK_MS) {
    store.delete(key)
    return null
  }

  return { elements: hit.elements, stale: age > FRESH_MS }
}

export function writeCache(key: string, elements: OsmElement[]) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { elements, at: Date.now() })
}
