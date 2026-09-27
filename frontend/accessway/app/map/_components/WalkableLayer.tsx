'use client'

import { CircleMarker, Polyline, Tooltip } from 'react-leaflet'

import type { KerbPoint, PathSegment } from '@/types/paths'

/**
 * The sidewalk network, coloured by whether a wheelchair can actually use it.
 *
 * This is the question the app exists to answer: not "is that cafe accessible"
 * but "can I get there". A perfect sidewalk that ends at a high curb is not a
 * route, and no amount of destination data will tell you that.
 *
 * Untagged stretches are drawn faint rather than hidden. "Nobody has surveyed
 * this" is real information; drawing nothing would imply the way is clear.
 */

const PATH_STYLE = {
  yes: { color: 'var(--tag-green)', weight: 5, opacity: 0.9, label: 'Flat, no stairs' },
  limited: { color: 'var(--tag-orange)', weight: 5, opacity: 0.9, label: 'Bumpy or tight' },
  no: { color: 'var(--tag-red)', weight: 5, opacity: 0.95, label: 'Stairs, no ramp' },
  unknown: { color: 'var(--subtle)', weight: 2.5, opacity: 0.4, label: 'Nobody has checked' },
} as const

const KERB_STYLE = {
  flush: { color: 'var(--tag-green)', label: 'Level with the road' },
  lowered: { color: 'var(--tag-green)', label: 'Dropped curb' },
  raised: { color: 'var(--tag-red)', label: 'High curb - no ramp down' },
  unknown: { color: 'var(--subtle)', label: 'Curb not surveyed' },
} as const

/** SVG paint attributes can't read CSS variables, so resolve them to hex first. */
function resolve(value: string) {
  const match = value.match(/^var\((--[^)]+)\)$/)
  if (!match) return value
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || '#787774'
}

function details(path: PathSegment) {
  return [
    path.reason,
    path.surface && `Surface: ${path.surface.replace(/_/g, ' ')}`,
    path.width_m && `${path.width_m} m wide`,
    path.tactile_paving === true && 'Tactile paving',
  ].filter(Boolean) as string[]
}

export function WalkableLayer({ paths, kerbs }: { paths: PathSegment[]; kerbs: KerbPoint[] }) {
  return (
    <>
      {paths.map((path) => {
        const style = PATH_STYLE[path.access]
        const lines = details(path)

        return (
          <Polyline
            key={path.id}
            // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
            positions={path.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: resolve(style.color),
              weight: style.weight,
              opacity: style.opacity,
              // Dashes read as "not this way" even for a colour-blind viewer.
              dashArray: path.access === 'no' ? '6 5' : undefined,
              lineCap: 'round',
            }}
          >
            <Tooltip sticky>
              <strong>{style.label}</strong>
              {lines.length > 0 && <div className="text-xs">{lines.join(' · ')}</div>}
            </Tooltip>
          </Polyline>
        )
      })}

      {kerbs.map((kerb) => {
        const style = KERB_STYLE[kerb.kerb]
        return (
          <CircleMarker
            key={kerb.id}
            center={[kerb.lat, kerb.lng]}
            radius={kerb.kerb === 'raised' ? 5 : 4}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: resolve(style.color),
              fillOpacity: kerb.kerb === 'unknown' ? 0.4 : 1,
            }}
          >
            <Tooltip>{style.label}</Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
