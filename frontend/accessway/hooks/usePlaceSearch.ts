'use client'

import { useEffect, useRef, useState } from 'react'

import { api, isBackendMissing } from '@/lib/api'
import type { Place } from '@/types/places'

/**
 * Type-ahead search for the From and To fields: places, addresses, streets,
 * cities and countries, anywhere in the world (see app/api/v1/search).
 *
 * The bbox makes results lean toward you — or the map, if your location is
 * unknown — without hiding well-known places elsewhere.
 */
export function usePlaceSearch(query: string, bbox: string | null, near?: { lat: number; lng: number } | null) {
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  // Stops a slower earlier response from overwriting a newer one.
  const latest = useRef(0)

  useEffect(() => {
    const term = query.trim()

    if (term.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    const ticket = ++latest.current

    // Wait for a pause in typing, so a burst of keystrokes is one search.
    const timer = setTimeout(async () => {
      try {
        // A box around the user beats the viewport: they may have panned away,
        // but "near me" is what they mean by a place name.
        const around = near
          ? `${near.lng - 0.045},${near.lat - 0.035},${near.lng + 0.045},${near.lat + 0.035}`
          : (bbox ?? undefined)
        const { items } = await api.searchPlaces(term, around)
        if (ticket !== latest.current) return
        setResults(items)
        setError(null)
        setOffline(false)
      } catch (err) {
        if (ticket !== latest.current) return
        setResults([])
        // A missing backend is not a search failure; the panel says what is needed.
        setOffline(isBackendMissing(err))
        setError(isBackendMissing(err) ? null : err instanceof Error ? err.message : 'Search is unavailable right now.')
      } finally {
        if (ticket === latest.current) setLoading(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query, bbox, near?.lat, near?.lng])

  return { results, loading, error, offline }
}
