'use client'

import { useCallback, useEffect, useState } from 'react'

import type { LatLng } from '@/types/places'

export type GeoFix = LatLng & { accuracy: number }
export type GeoStatus = 'idle' | 'locating' | 'error'

function describe(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) return 'Location is blocked. Allow it in your browser’s address bar, then try again.'
  if (err.code === err.TIMEOUT) return 'Finding you took too long. Try again.'
  return "Couldn't work out where you are."
}

/**
 * Where the person is, asked for once when the map opens.
 *
 * Most trips start where you are standing, so the map opens on you and "From"
 * defaults to your location. If you have already blocked location we don't
 * nag: the permission check skips the request and "From" says why it's empty.
 *
 * Geolocation needs a secure context, so it works on localhost and on HTTPS but
 * silently does nothing on a plain-http LAN address such as
 * `http://192.168.x.x:3000`.
 */
export function useGeolocation({ auto = true }: { auto?: boolean } = {}) {
  const [position, setPosition] = useState<GeoFix | null>(null)
  const [status, setStatus] = useState<GeoStatus>(auto ? 'locating' : 'idle')
  const [message, setMessage] = useState<string | null>(null)

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error')
      setMessage('This browser has no location support.')
      return
    }

    setStatus('locating')
    setMessage(null)

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy })
        setStatus('idle')
      },
      (err) => {
        setStatus('error')
        setMessage(describe(err))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])

  useEffect(() => {
    if (!auto) return
    let cancelled = false

    async function start() {
      try {
        const permission = await navigator.permissions?.query({ name: 'geolocation' })
        if (cancelled) return
        if (permission?.state === 'denied') {
          setStatus('error')
          setMessage('Location is blocked. Allow it in your browser’s address bar, then try again.')
          return
        }
      } catch {
        // Some browsers can't query this permission; just ask.
      }
      if (!cancelled) locate()
    }

    start()
    return () => {
      cancelled = true
    }
  }, [auto, locate])

  return { position, status, message, locate }
}
