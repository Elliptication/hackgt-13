'use client'

import { useEffect } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'

import type { Route } from '@/types/routes'

/**
 * Draws the planned trip. A white casing under a coloured core keeps the line
 * legible over any basemap, the way every road map has done it for a century.
 *
 * Green means nothing known blocks it; amber means something does and the
 * panel says what. We never draw a route we would not explain.
 */
export function RouteLayer({ route }: { route: Route }) {
  const map = useMap()

  // Leaflet wants [lat, lng]; GeoJSON stores [lng, lat].
  const positions = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])

  // Frame the whole trip whenever a new one arrives.
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [64, 64], maxZoom: 18 })
    }
    // Re-fit per route, not per render — positions is a fresh array each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id, route.distance_m, map])

  const color = route.step_free ? 'var(--tag-green)' : 'var(--tag-orange)'
  const start = positions[0]
  const end = positions[positions.length - 1]

  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round' }} />
      <Polyline positions={positions} pathOptions={{ color, weight: 6, opacity: 1, lineCap: 'round' }} />

      {start && (
        <CircleMarker
          center={start}
          radius={8}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0b6bcb', fillOpacity: 1 }}
        >
          <Tooltip>Start</Tooltip>
        </CircleMarker>
      )}
      {end && (
        <CircleMarker
          center={end}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#37352f', fillOpacity: 1 }}
        >
          <Tooltip>Destination</Tooltip>
        </CircleMarker>
      )}
    </>
  )
}
