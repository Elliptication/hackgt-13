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
 * Load map data the way every web map does: by tile, once, and keep it.
 *
 * Fetching by viewport meant no two requests were ever alike, so every nudge of
 * the map was a cold fetch and the markers vanished while it ran. Quantising to
 * a fixed grid means panning asks only for cells not already held — usually
 * none — and moving back is instant.
 *
 * Two rules follow, and both matter more than they look:
 *
 *  - Loaded tiles are never dropped. Data only accumulates, so the map never
 *    empties underneath someone who is reading it.
 *  - A failed tile is remembered as failed, so a dead area is not retried on
 *    every pan.
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
  const failed = useRef(new Set<string>())
  const inFlight = useRef(new Set<string>())

  // Zoomed too far out for this data to be readable, or useful.
  const tooFarOut = zoom !== null && zoom < MIN_DATA_ZOOM

  useEffect(() => {
    if (!enabled || !bbox || tooFarOut) return

    // tilesForBbox returns centre-first, which matters below.
    const wanted = tilesForBbox(parseBbox(bbox))
    const missing = wanted.filter((t) => {
      const key = tileKey(t)
      return !loaded.current.has(key) && !failed.current.has(key) && !inFlight.current.has(key)
    })

    if (missing.length === 0) return

    let cancelled = false
    let offline = false

    // A short settle delay so a drag does not fire a request per frame.
    const timer = setTimeout(async () => {
      setLoading(true)
      missing.forEach((t) => inFlight.current.add(tileKey(t)))

      const publish = () => {
        if (!cancelled) setBodies([...loaded.current.values()])
      }

      const load = async (tile: Tile) => {
        const key = tileKey(tile)
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
            // Signalled as a condition, not a sentence: the UI answers it by
            // showing what the backend still owes us.
            offline = true
            throw new Error('offline')
          }

          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { detail?: string }
            throw new Error(body.detail ?? 'Could not load this area.')
          }
          loaded.current.set(key, (await res.json()) as Body)
          // Paint each tile the moment it lands, rather than making the first
          // one wait for the slowest. A cold tile is several seconds.
          publish()
        } catch (err) {
          failed.current.add(key)
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this area.')
        } finally {
          inFlight.current.delete(key)
        }
      }

      // The tile under the middle of the screen first: it is the one being
      // looked at, and it alone makes the map feel loaded.
      const [centre, ...rest] = missing
      if (centre) await load(centre)
      if (!cancelled) await Promise.all(rest.map(load))

      if (cancelled) return
      setNoBackend(offline)
      setLoading(inFlight.current.size > 0)

      // Now that the screen is filled, quietly pull in the ring around it so a
      // pan into a neighbour is instant. Not awaited, and never reported as
      // loading — nobody is waiting on this.
      const ahead = neighboursOf(wanted).filter((t) => {
        const k = tileKey(t)
        return !loaded.current.has(k) && !failed.current.has(k) && !inFlight.current.has(k)
      })

      for (const tile of ahead.slice(0, 5)) {
        inFlight.current.add(tileKey(tile))
        void load(tile)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bbox, enabled, path, tooFarOut])

  return { bodies, loading, error, noBackend, tooFarOut, tilesLoaded: loaded.current.size }
}
