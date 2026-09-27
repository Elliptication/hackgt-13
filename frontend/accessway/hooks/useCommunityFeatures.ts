'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { accessway, isBackendDown, METRES_PER_MILE, type CommunityFeature } from '@/lib/api/accessway'
import { parseBbox } from '@/lib/geo/bbox'
import { MIN_DATA_ZOOM, tileKey, tilesForBbox, tileToCircle } from '@/lib/geo/tiles'

/**
 * What people have added, for the area on screen.
 *
 * The AccessWay API asks for a point and a radius, and a raw map centre changes
 * on every pixel of pan — so nothing would ever be a cache hit and a drag would
 * fire a request per frame. The circle is derived from the same slippy tiles the
 * rest of the map already uses instead, which quantises it: one cell is always
 * the same lat/long/radius, asked for once.
 *
 * Loaded cells are kept. Panning back is instant, and the map never empties
 * underneath someone who is reading it.
 */

/**
 * How long a failed cell is left alone before being tried again.
 *
 * Not "never": the service comes and goes during a deploy, and a map that stays
 * empty until someone thinks to reload is worse than one that fills in by
 * itself half a minute later. Long enough that a service which is properly down
 * is asked twice a minute, not continuously.
 */
const RETRY_AFTER_MS = 30_000

export function useCommunityFeatures(bbox: string | null, zoom: number | null) {
  const [features, setFeatures] = useState<CommunityFeature[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  /** Bumped when cooled-down failures are worth another go. */
  const [round, setRound] = useState(0)

  const loaded = useRef(new Map<string, CommunityFeature[]>())
  /** Cell key → when it last failed. */
  const failed = useRef(new Map<string, number>())
  const inFlight = useRef(new Set<string>())
  /** The pending "try the failed cells again" timer. */
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tooFarOut = zoom !== null && zoom < MIN_DATA_ZOOM

  useEffect(() => {
    if (!bbox || tooFarOut) return

    const now = Date.now()
    const missing = tilesForBbox(parseBbox(bbox)).filter((t) => {
      const key = tileKey(t)
      if (loaded.current.has(key) || inFlight.current.has(key)) return false
      const failedAt = failed.current.get(key)
      return failedAt === undefined || now - failedAt >= RETRY_AFTER_MS
    })
    if (missing.length === 0) return

    let cancelled = false
    const controller = new AbortController()

    // A short settle delay, so a drag does not fire a request per frame.
    const timer = setTimeout(async () => {
      setLoading(true)
      missing.forEach((t) => inFlight.current.add(tileKey(t)))
      let down = false

      await Promise.all(
        missing.map(async (tile) => {
          const key = tileKey(tile)
          const { lat, lng, radius } = tileToCircle(tile)
          try {
            const found = await accessway.getFeatures(
              { lat, lng, radiusMiles: Number((radius / METRES_PER_MILE).toFixed(4)) },
              controller.signal,
            )
            loaded.current.set(key, found)
            failed.current.delete(key)
            if (!cancelled) {
              setFeatures([...loaded.current.values()].flat())
              setUnavailable(false)
              setError(null)
            }
          } catch (err) {
            if (controller.signal.aborted) return
            // Remembered with a timestamp, not a flag: a dead area is not
            // retried on every pan, but it is not written off for the session
            // either.
            failed.current.set(key, Date.now())
            if (cancelled) return
            // The service being absent is a state of the handover, not a fault
            // of this area — the UI says so once rather than per cell.
            if (isBackendDown(err)) down = true
            else setError(err instanceof Error ? err.message : 'Could not load community reports here.')
          } finally {
            inFlight.current.delete(key)
          }
        }),
      )

      if (cancelled) return
      setLoading(inFlight.current.size > 0)
      if (down) setUnavailable(true)

      // Something failed, so come back to it. This is what makes the map fill
      // in on its own when the API returns, without a reload.
      if (failed.current.size > 0) {
        if (retry.current) clearTimeout(retry.current)
        retry.current = setTimeout(() => setRound((n) => n + 1), RETRY_AFTER_MS)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [bbox, tooFarOut, round])

  useEffect(() => {
    return () => {
      if (retry.current) clearTimeout(retry.current)
    }
  }, [])

  // A feature on a cell edge comes back from both neighbours, so the union has
  // to be keyed by id or React sees duplicate keys.
  const unique = useMemo(() => [...new Map(features.map((f) => [f.id, f])).values()], [features])

  return {
    /** Confirmed by enough people to stand on the map beside surveyed data. */
    features: useMemo(() => unique.filter((f) => f.verified), [unique]),
    /** Added, but still waiting on the community. */
    pending: useMemo(() => unique.filter((f) => !f.verified), [unique]),
    loading,
    error,
    /** The API is not answering at all — see lib/api/accessway.ts. */
    unavailable,
  }
}
