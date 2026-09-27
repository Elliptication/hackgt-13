'use client'

import { useEffect, useRef, useState } from 'react'

import { apiUrl } from '@/lib/api'
import { parseBbox } from '@/lib/geo/bbox'
import {
  MIN_DATA_ZOOM,
  neighboursOf,
  tileKey,
  tilesForBbox,
  tileToBbox,
  tileToCircle,
  type Tile,
} from '@/lib/geo/tiles'

/**
 * A tile that failed is left alone for this long, then tried again the next
 * time it's on screen. Remembering failures forever meant one slow response
 * from OpenStreetMap blanked that area until a full page reload.
 */
const RETRY_AFTER_MS = 20_000

/**
 * Load map data the way every web map does: by tile, once, and keep it.
 *
 * Fetching by viewport meant no two requests were ever alike, so every nudge of
 * the map was a cold fetch and the markers vanished while it ran. Quantising to
 * a fixed grid means panning asks only for cells not already held — usually
 * none — and moving back is instant.
 *
 * Rules that matter more than they look:
 *
 *  - Loaded tiles are never dropped. Data only accumulates, so the map never
 *    empties underneath someone who is reading it.
 *  - A tile that lands is ALWAYS shown, even if the map moved while it was
 *    loading. Moving the map (which happens constantly while zooming in) used
 *    to throw the result away, so an area could load and never appear.
 *  - A failed tile is not retried on every pan, but is retried after a pause.
 *
 * Whole response bodies are kept rather than one extracted field, so an endpoint
 * returning several collections (paths *and* kerbs) costs one request, not one
 * per collection.
 */
export function useTiledData<Body>(
  path: 'features' | 'paths' | 'places',
  bbox: string | null,
  zoom: number | null,
  enabled = true,
) {
  const [bodies, setBodies] = useState<Body[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noBackend, setNoBackend] = useState(false)

  const loaded = useRef(new Map<string, Body>())
  /** Tile key → when it failed. */
  const failed = useRef(new Map<string, number>())
  const inFlight = useRef(new Set<string>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Zoomed too far out for this data to be readable, or useful.
  const tooFarOut = zoom !== null && zoom < MIN_DATA_ZOOM

  useEffect(() => {
    if (!enabled || !bbox || tooFarOut) return

    const needs = (t: Tile) => {
      const key = tileKey(t)
      if (loaded.current.has(key) || inFlight.current.has(key)) return false
      const failedAt = failed.current.get(key)
      return failedAt === undefined || Date.now() - failedAt > RETRY_AFTER_MS
    }

    // tilesForBbox returns centre-first, which matters below.
    const wanted = tilesForBbox(parseBbox(bbox))
    if (!wanted.some(needs)) return

    // Only stops *starting* further tiles for a view that's been left behind.
    // Tiles already requested still land and still get drawn.
    let cancelled = false

    const load = async (tile: Tile) => {
      const key = tileKey(tile)
      inFlight.current.add(key)
      if (mounted.current) setLoading(true)

      try {
        // Send the same cell three ways, so this works against a backend
        // that takes a tile, a bbox, or a point and radius. Every form is
        // derived from the tile, so all three stay quantised and cacheable —
        // and a server simply ignores the parameters it does not use.
        const circle = tileToCircle(tile)
        const box = tileToBbox(tile)
        const query = new URLSearchParams({
          tile: key,
          bbox: `${box.west},${box.south},${box.east},${box.north}`,
          lat: circle.lat.toFixed(6),
          long: circle.lng.toFixed(6),
          lng: circle.lng.toFixed(6),
          radius: String(circle.radius),
        })

        let res: Response
        try {
          res = await fetch(apiUrl(`/${path}?${query}`))
        } catch {
          // fetch only rejects on network failure — the backend is not there.
          if (mounted.current) setNoBackend(true)
          throw new Error('offline')
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string }
          throw new Error(body.detail ?? 'Could not load this area.')
        }

        loaded.current.set(key, (await res.json()) as Body)
        failed.current.delete(key)

        // Paint each tile the moment it lands, rather than making the first
        // one wait for the slowest. A cold tile is several seconds.
        if (mounted.current) {
          setBodies([...loaded.current.values()])
          setError(null)
          setNoBackend(false)
        }
      } catch (err) {
        failed.current.set(key, Date.now())
        if (mounted.current) setError(err instanceof Error ? err.message : 'Could not load this area.')
      } finally {
        inFlight.current.delete(key)
        if (mounted.current) setLoading(inFlight.current.size > 0)
      }
    }

    // A short settle delay so a drag does not fire a request per frame.
    const timer = setTimeout(async () => {
      // Re-check at fire time: something may have landed during the delay.
      const missing = wanted.filter(needs)
      if (missing.length === 0) return

      // The tile under the middle of the screen first: it is the one being
      // looked at, and it alone makes the map feel loaded.
      const [centre, ...rest] = missing
      await load(centre)
      if (cancelled) return
      await Promise.all(rest.map(load))
      if (cancelled) return

      // Now that the screen is filled, quietly pull in the ring around it so a
      // pan into a neighbour is instant. Not awaited — nobody is waiting on it.
      for (const tile of neighboursOf(wanted).filter(needs).slice(0, 5)) {
        void load(tile)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bbox, enabled, path, tooFarOut])

  return { bodies, loading, error, noBackend, tooFarOut, tilesLoaded: bodies.length }
}
