'use client'

import { useCallback, useState } from 'react'

import { api, isBackendMissing } from '@/lib/api'
import type { LatLng, Place } from '@/types/places'
import type { Route } from '@/types/routes'

/**
 * One trip: from where you are, to somewhere you chose.
 *
 * Routing takes a few seconds — the plan itself is quick, but checking it
 * against OpenStreetMap's accessibility data is not. `loading` is the whole
 * wait, so the UI can say what it is doing rather than just spinning.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route | null>(null)
  const [destination, setDestination] = useState<Place | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const findRoute = useCallback(async (from: LatLng, to: Place) => {
    setLoading(true)
    setError(null)
    setOffline(false)
    setDestination(to)

    try {
      const { routes } = await api.getRoute({
        from,
        to: { lat: to.lat, lng: to.lng },
        avoid: ['stairs'],
        max_incline_pct: 8,
      })
      setRoute(routes[0] ?? null)
      if (!routes.length) setError('No route came back for that trip.')
    } catch (err) {
      setRoute(null)
      setOffline(isBackendMissing(err))
      setError(isBackendMissing(err) ? null : err instanceof Error ? err.message : 'We could not plan that trip.')
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setRoute(null)
    setDestination(null)
    setError(null)
    setOffline(false)
  }, [])

  return { route, destination, loading, error, offline, findRoute, clear }
}
