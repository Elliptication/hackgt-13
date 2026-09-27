'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { LatLng } from '@/types/places'

export type GeoFix = LatLng & { accuracy: number }
export type GeoStatus = 'idle' | 'locating' | 'error'

/**
 * GPS wobbles by a few metres even when you're standing still. Moves smaller
 * than this are ignored, so the dot doesn't jitter and everything that depends
 * on your position (the map, search, a "from here" route) isn't redone every
 * second for nothing.
 */
const MIN_MOVE_M = 5

const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }

function describe(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) return 'Location is blocked. Allow it in your browser’s address bar, then try again.'
  if (err.code === err.TIMEOUT) return 'Finding you took too long. Try again.'
  return "Couldn't work out where you are."
}

/** Metres between two points. Flat-earth is plenty at walking distances. */
function metresBetween(a: LatLng, b: LatLng) {
  const dLat = (b.lat - a.lat) * 111_320
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

/**
 * Where the person is, kept up to date as they move.
 *
 * Asked for once when the map opens, then watched: the blue dot follows you,
 * and "Your location" as a starting point is always where you are now. The map
 * itself isn't moved by updates — LeafletMap only re-centres on load and when
 * the locate button is pressed — so it never pulls away from what you're
 * looking at.
 *
 * If you have already blocked location we don't nag: the permission check
 * skips the request and "From" says why it's empty.
 *
 * Geolocation needs a secure context, so it works on localhost and on HTTPS but
 * silently does nothing on a plain-http LAN address such as
 * `http://192.168.x.x:3000`.
 */
export function useGeolocation({ auto = true }: { auto?: boolean } = {}) {
  const [position, setPosition] = useState<GeoFix | null>(null)
  const [status, setStatus] = useState<GeoStatus>(auto ? 'locating' : 'idle')
  const [message, setMessage] = useState<string | null>(null)

  const last = useRef<GeoFix | null>(null)
  const watchId = useRef<number | null>(null)

  /** Take a fix, unless it's just GPS wobble around the one we have. */
  const accept = useCallback((coords: GeolocationCoordinates, force = false) => {
    const next = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }
    const prev = last.current
    const moved = !prev || metresBetween(prev, next) >= MIN_MOVE_M
    // A much better fix of the same spot is still worth taking (e.g. GPS
    // locking on after a rough first guess from Wi-Fi).
    const sharper = !!prev && next.accuracy < prev.accuracy / 2
    if (force || moved || sharper) {
      last.current = next
      setPosition(next)
    }
    setStatus('idle')
    setMessage(null)
  }, [])

  /** Keep following the person. Safe to call more than once. */
  const watch = useCallback(() => {
    if (watchId.current !== null || typeof navigator === 'undefined' || !navigator.geolocation) return
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => accept(coords),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
          watchId.current = null
          setStatus('error')
          setMessage(describe(err))
        }
        // A timeout mid-walk (a tunnel, a lift) isn't worth an error while
        // we still have a recent position — the watch carries on by itself.
        else if (!last.current) {
          setStatus('error')
          setMessage(describe(err))
        }
      },
      OPTIONS,
    )
  }, [accept])

  /**
   * Find the person right now (the locate button, or choosing "Your location").
   * Always hands back a fresh position, so the map re-centres even if you
   * haven't moved, and starts following from then on.
   */
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
        accept(coords, true)
        watch()
      },
      (err) => {
        setStatus('error')
        setMessage(describe(err))
      },
      OPTIONS,
    )
  }, [accept, watch])

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

  // Stop following when the map goes away.
  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  return { position, status, message, locate }
}
