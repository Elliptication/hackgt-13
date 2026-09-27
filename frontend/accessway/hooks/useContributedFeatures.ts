'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { accessway, placed, type CommunityFeature, type PlacedFeature } from '@/lib/api/accessway'

/**
 * Most lookups in one pass. `/contributions/` is the whole table, so without a
 * ceiling a grown table would fire one request per row on every page load.
 */
const MAX_LOOKUPS = 60

/**
 * Community features found by id rather than by area, so the map can draw them.
 *
 * The area search (`GET /features?lat&long&radius`) cannot be relied on: it has
 * been answering `[]` for every point, and `POST /contributions/` never writes
 * the `lat`/`long` columns it reads anyway. `GET /features/{id}` does work — it
 * returns the `location` geometry, which `toCommunityFeature` decodes — and the
 * photo table (`GET /contributions/`) lists every feature id there is. This is
 * the same join the review queue uses.
 *
 * `ids` are the backend's raw feature ids. Each is looked up once per page load.
 */
export function useContributedFeatures(ids: Iterable<string>) {
  const key = useMemo(() => [...ids].sort().join(','), [ids])
  const [found, setFound] = useState<Map<string, CommunityFeature>>(() => new Map())
  /** Asked for already, or in flight. Kept so a re-render doesn't ask again. */
  const asked = useRef(new Set<string>())

  useEffect(() => {
    const missing = (key ? key.split(',') : []).filter((id) => !asked.current.has(id)).slice(0, MAX_LOOKUPS)
    if (missing.length === 0) return
    const askedIds = asked.current
    missing.forEach((id) => askedIds.add(id))

    const controller = new AbortController()
    Promise.all(missing.map((id) => accessway.getFeature(id, controller.signal).catch(() => null))).then(
      (results) => {
        if (controller.signal.aborted) return
        setFound((prev) => {
          const next = new Map(prev)
          for (const f of results) if (f) next.set(f.featureId, f)
          return next
        })
      },
    )

    return () => {
      controller.abort()
      // Aborted before answering, so they were never really asked.
      missing.forEach((id) => askedIds.delete(id))
    }
  }, [key])

  /** Only what can be drawn: a feature with no stored position has nowhere to go. */
  const features = useMemo(() => [...found.values()].filter(placed), [found])
  return features as PlacedFeature[]
}
