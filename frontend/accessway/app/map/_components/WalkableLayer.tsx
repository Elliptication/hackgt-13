'use client'

import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'

import type { KerbPoint, PathSegment } from '@/types/paths'

import { sharedCanvas } from './sharedCanvas'

/**
 * The sidewalk network, coloured by whether a wheelchair can actually use it.
 *
 * This is the question the app exists to answer: not "is that cafe accessible"
 * but "can I get there". A perfect sidewalk that ends at a high curb is not a
 * route, and no amount of destination data will tell you that.
 *
 * Untagged stretches are drawn faint rather than hidden. "Nobody has surveyed
 * this" is real information; drawing nothing would imply the way is clear.
 *
 * Performance — a few neighbourhoods is thousands of segments and curb dots:
 *  - They're all painted onto one shared canvas (see sharedCanvas.ts), not
 *    created as thousands of SVG elements.
 *  - They're handed to Leaflet directly rather than rendered as React
 *    components. With React in between, every pan re-reconciled thousands of
 *    components that draw nothing themselves, and that was most of the lag.
 *  - Each segment is created once. When a new area loads, only the new ones
 *    are added.
 *  - Tooltips are built only when one is actually hovered.
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

/** Canvas can't read CSS variables, so resolve them to real colours first. */
function resolve(value: string, root: CSSStyleDeclaration) {
  const match = value.match(/^var\((--[^)]+)\)$/)
  if (!match) return value
  return root.getPropertyValue(match[1]).trim() || '#787774'
}

function details(path: PathSegment) {
  return [
    path.reason,
    path.surface && `Surface: ${path.surface.replace(/_/g, ' ')}`,
    path.width_m && `${path.width_m} m wide`,
    path.tactile_paving === true && 'Tactile paving',
  ].filter(Boolean) as string[]
}

/** Tooltip content as DOM nodes (textContent, so data can never inject HTML). */
function tooltip(label: string, lines: string[] = []) {
  const el = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = label
  el.append(strong)
  if (lines.length > 0) {
    const small = document.createElement('div')
    small.className = 'text-xs'
    small.textContent = lines.join(' · ')
    el.append(small)
  }
  return el
}

export function WalkableLayer({ paths, kerbs }: { paths: PathSegment[]; kerbs: KerbPoint[] }) {
  const map = useMap()

  // The shared canvas, and one group holding every line and dot.
  const renderer = useMemo(() => sharedCanvas(map), [map])
  const group = useMemo(() => L.layerGroup(), [])
  const drawn = useRef(new Map<string, L.Layer>())

  useEffect(() => {
    group.addTo(map)
    return () => {
      group.remove()
    }
  }, [group, map])

  // Add what's new, remove what's gone. Existing shapes are left untouched.
  useEffect(() => {
    const root = getComputedStyle(document.documentElement)
    const current = new Set<string>()

    for (const path of paths) {
      const key = `p:${path.id}`
      current.add(key)
      if (drawn.current.has(key)) continue

      const style = PATH_STYLE[path.access]
      const layer = L.polyline(
        // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
        path.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
        {
          renderer,
          color: resolve(style.color, root),
          weight: style.weight,
          opacity: style.opacity,
          // Dashes read as "not this way" even for a colour-blind viewer.
          dashArray: path.access === 'no' ? '6 5' : undefined,
          lineCap: 'round',
        },
      ).bindTooltip(() => tooltip(style.label, details(path)), { sticky: true })

      group.addLayer(layer)
      // Under the feature dots that share this canvas.
      layer.bringToBack()
      drawn.current.set(key, layer)
    }

    for (const kerb of kerbs) {
      const key = `k:${kerb.id}`
      current.add(key)
      if (drawn.current.has(key)) continue

      const style = KERB_STYLE[kerb.kerb]
      const layer = L.circleMarker([kerb.lat, kerb.lng], {
        renderer,
        radius: kerb.kerb === 'raised' ? 5 : 4,
        color: '#ffffff',
        weight: 1.5,
        fillColor: resolve(style.color, root),
        fillOpacity: kerb.kerb === 'unknown' ? 0.4 : 1,
      }).bindTooltip(() => tooltip(style.label))

      group.addLayer(layer)
      layer.bringToBack()
      drawn.current.set(key, layer)
    }

    for (const [key, layer] of drawn.current) {
      if (!current.has(key)) {
        group.removeLayer(layer)
        drawn.current.delete(key)
      }
    }
  }, [paths, kerbs, group, renderer])

  return null
}
