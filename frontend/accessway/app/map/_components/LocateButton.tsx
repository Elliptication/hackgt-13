'use client'

import { LocateFixed, LoaderCircle } from 'lucide-react'
import { CircleMarker, Circle, Tooltip } from 'react-leaflet'

import type { GeoFix, GeoStatus } from '@/hooks/useGeolocation'

/**
 * Above this, the reported accuracy is a guess rather than a measurement — a
 * desktop browser with no GPS commonly reports kilometres — so the circle is
 * not drawn at all.
 */
const ACCURACY_LIMIT_M = 150

/**
 * "Where am I" — the button on the map plus the blue dot.
 *
 * The location itself lives in `useGeolocation` (owned by MapView) so the map,
 * the trip planner and search all share one fix.
 */
export function LocateButton({
  position,
  status,
  message,
  onLocate,
}: {
  position: GeoFix | null
  status: GeoStatus
  message: string | null
  onLocate: () => void
}) {
  return (
    <>
      {/* Sits above the map panes; Leaflet's own controls use z-[1000] */}
      <div className="leaflet-bottom leaflet-right pointer-events-none" style={{ marginBottom: 84 }}>
        <div className="leaflet-control pointer-events-auto">
          <button
            type="button"
            onClick={onLocate}
            disabled={status === 'locating'}
            aria-label="Show my location"
            title={message ?? 'Show my location'}
            className={`grid size-[34px] place-items-center rounded-md border-2 bg-background text-foreground shadow-md transition-colors hover:bg-hover disabled:opacity-70 ${
              status === 'error' ? 'border-[var(--tag-red)]' : 'border-black/20'
            }`}
          >
            {status === 'locating' ? (
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Screen-reader feedback, since the button's own label can't announce results */}
      <div className="sr-only" role="status" aria-live="polite">
        {status === 'locating' && 'Finding your location…'}
        {message}
      </div>

      {position && (
        <>
          {/*
            The accuracy circle is only drawn when the fix is actually precise.

            `coords.accuracy` is a radius in metres, and a browser without GPS
            falls back to IP geolocation, which routinely reports one to fifty
            kilometres. Drawing that faithfully covers the entire screen in blue
            and tells nobody anything. Above the threshold the dot alone is the
            honest signal: roughly here, precision unknown.
          */}
          {position.accuracy <= ACCURACY_LIMIT_M && (
            <Circle
              center={[position.lat, position.lng]}
              radius={position.accuracy}
              pathOptions={{ color: 'var(--primary)', weight: 1, fillColor: 'var(--primary)', fillOpacity: 0.1 }}
            />
          )}
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={6}
            pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: '#0b6bcb', fillOpacity: 1 }}
          >
            <Tooltip>
              You are here
              {position.accuracy > ACCURACY_LIMIT_M && ` (approximate, ±${Math.round(position.accuracy)} m)`}
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </>
  )
}
