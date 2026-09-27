'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'

import { MapContainer, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'

import { MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '@/lib/map'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import type { AccessFeature, FeatureType } from '@/types/features'
import type { KerbPoint, PathSegment } from '@/types/paths'
import type { LatLng } from '@/types/places'
import type { Route } from '@/types/routes'
import type { Contribution } from '@/types/contribute'
import type { GeoFix, GeoStatus } from '@/hooks/useGeolocation'
import { reportOpacity } from '@/lib/contribute'

import { DroppedPin } from './DroppedPin'
import { FeatureMarker } from './FeatureMarker'
import { LocateButton } from './LocateButton'
import { RouteLayer } from './RouteLayer'
import { WalkableLayer } from './WalkableLayer'
import { sharedCanvas } from './sharedCanvas'
import { useVisibleBounds } from './useVisibleBounds'

const DEFAULT_CENTER: [number, number] = [33.7756, -84.3963] // Georgia Tech
const DEFAULT_ZOOM = 16

type Props = {
  features: AccessFeature[]
  paths?: PathSegment[]
  kerbs?: KerbPoint[]
  showWalkable?: boolean
  route?: Route | null
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** The person's own position, drawn as the blue dot. The map flies to each new fix. */
  myLocation?: GeoFix | null
  locationStatus?: GeoStatus
  locationMessage?: string | null
  onLocate?: () => void
  /** When set, the next map click drops a pin instead of doing nothing. */
  pinMode?: boolean
  onPinDrop?: (at: LatLng) => void
  /** Approved community photos, matched to nearby features. */
  contributions?: Contribution[]
  /** Points the user has dropped, so they can see where they landed. */
  markers?: { id: string; at: LatLng; label: string }[]
  /** Reports the viewport as `minLng,minLat,maxLng,maxLat` so data follows the map. */
  onBoundsChange?: (bbox: string, zoom: number) => void
}

/**
 * Fly to whatever is selected, wherever the selection came from.
 *
 * Picking something in the sidebar used to highlight its pin and nothing else —
 * so if it was off-screen, the click appeared to do nothing at all. Moving the
 * map is what makes a list row feel like it points at a place.
 */
function FlyToSelected({ feature }: { feature?: AccessFeature }) {
  const map = useMap()

  useEffect(() => {
    if (!feature) return
    // Never zoom out on select: if they are already closer in, respect that.
    map.flyTo([feature.lat, feature.lng], Math.max(map.getZoom(), 18), { duration: 0.7 })
  }, [feature, map])

  return null
}

/**
 * Centre on the person when their location arrives — but only if they asked.
 *
 * "Asked" means: the page just opened and they haven't done anything yet, or
 * they pressed the locate button. A browser can take several seconds to report
 * a location, and centring on every fix meant that if you picked a feature in
 * the meantime, the map flew there and then snapped back to you.
 *
 * Picking a feature or dragging the map cancels a pending centre.
 */
function FlyToMe({
  at,
  selectedId,
  pendingRef,
}: {
  at?: GeoFix | null
  selectedId: string | null
  pendingRef: RefObject<boolean>
}) {
  const map = useMap()

  useMapEvents({
    dragstart: () => {
      pendingRef.current = false
    },
  })

  useEffect(() => {
    if (selectedId) pendingRef.current = false
  }, [selectedId, pendingRef])

  useEffect(() => {
    if (!at || !pendingRef.current) return
    pendingRef.current = false
    map.flyTo([at.lat, at.lng], Math.max(map.getZoom(), 17), { duration: 0.8 })
  }, [at, map, pendingRef])

  return null
}

/**
 * Tell the app where the map is looking, so what we load follows the viewport
 * instead of being pinned to one hard-coded place. This is what makes the app
 * work in any city rather than only on one campus.
 */
function ReportBounds({ onChange }: { onChange?: (bbox: string, zoom: number) => void }) {
  const map = useMap()

  const report = useCallback(() => {
    if (!onChange) return
    const b = map.getBounds()
    onChange(`${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`, map.getZoom())
  }, [map, onChange])

  // Report the opening view. Previously this hung off `layeradd` and read the
  // map handle from the same `const` that useMapEvents was still assigning, so
  // the very first call could hit the temporal dead zone and the initial bounds
  // were never reported at all — which meant no data ever loaded.
  useEffect(() => {
    report()
  }, [report])

  useMapEvents({
    moveend: report,
    zoomend: report,
  })

  return null
}

const NO_PHOTOS: Contribution[] = []
const noop = () => {}

/** Closer than this, features are full pins; further out, lightweight dots. */
const PIN_ZOOM = 17

/** Canvas can't read CSS variables, so turn `var(--x)` into its actual colour. */
function cssColor(value: string, root: CSSStyleDeclaration) {
  const match = value.match(/^var\((--[^)]+)\)$/)
  return match ? root.getPropertyValue(match[1]).trim() || '#787774' : value
}

/**
 * Ramps, lifts, entrances and restrooms — drawn at the level of detail the zoom
 * can actually show, which is how Google Maps stays smooth.
 *
 *  - Zoomed out (below PIN_ZOOM): small coloured dots, painted onto one canvas
 *    and handed straight to Leaflet. Thousands cost about the same as a
 *    handful, and they're still clickable. At this scale a full pin would cover
 *    its neighbours anyway. Each dot is created once; when an area loads, only
 *    its new dots are added.
 *  - Zoomed in: the full pins, with icons and photo popups. Each is a real HTML
 *    element, which is what made thousands of them lag, so only the ones near
 *    the screen are created.
 *
 * The selected feature is always a full pin, so its popup never disappears.
 */
function FeatureLayer({
  features,
  selectedId,
  onSelect,
  photosById,
}: {
  features: AccessFeature[]
  selectedId: string | null
  onSelect: (id: string) => void
  photosById: Map<string, Contribution[]>
}) {
  const map = useMap()
  const { bounds, zoom } = useVisibleBounds()
  const asDots = zoom < PIN_ZOOM

  // Shares one canvas with the walkable routes (drawn under the dots).
  const renderer = useMemo(() => sharedCanvas(map), [map])
  const dots = useMemo(() => L.layerGroup(), [])
  const drawn = useRef(new Map<string, L.CircleMarker>())

  // Clicks go through a ref so the dots never need rebuilding when the
  // handler's identity changes.
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (asDots) dots.addTo(map)
    else dots.remove()
    return () => {
      dots.remove()
    }
  }, [asDots, dots, map])

  // Add dots for new features, remove dots for features that are gone.
  useEffect(() => {
    const root = getComputedStyle(document.documentElement)
    const fill = Object.fromEntries(
      Object.entries(FEATURE_TYPES).map(([type, meta]) => [type, cssColor(meta.color, root)]),
    ) as Record<FeatureType, string>

    const current = new Set<string>()
    for (const f of features) {
      current.add(f.id)
      // Unconfirmed reports are faint, and fill in as yes votes come in.
      const opacity = reportOpacity(f.report)
      const existing = drawn.current.get(f.id)
      if (existing) {
        // Already drawn: only a change in votes needs repainting.
        if (existing.options.fillOpacity !== opacity) existing.setStyle({ opacity, fillOpacity: opacity })
        continue
      }
      const dot = L.circleMarker([f.lat, f.lng], {
        renderer,
        radius: 5,
        color: '#ffffff',
        weight: 1.5,
        opacity,
        fillColor: fill[f.type],
        fillOpacity: opacity,
      }).on('click', () => onSelectRef.current(f.id))
      dots.addLayer(dot)
      drawn.current.set(f.id, dot)
    }
    for (const [id, dot] of drawn.current) {
      if (!current.has(id)) {
        dots.removeLayer(dot)
        drawn.current.delete(id)
      }
    }
  }, [features, dots, renderer])

  const pins = useMemo(
    () =>
      features.filter((f) => f.id === selectedId || (!asDots && bounds.contains([f.lat, f.lng]))),
    [features, bounds, selectedId, asDots],
  )

  return pins.map((f) => (
    <FeatureMarker
      key={f.id}
      feature={f}
      selected={f.id === selectedId}
      onSelect={onSelect}
      photos={photosById.get(f.id) ?? NO_PHOTOS}
    />
  ))
}

/** Turns the next map click into a dropped pin. */
function PinDropper({ active, onDrop }: { active: boolean; onDrop?: (at: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      if (active) onDrop?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function LeafletMap({
  features,
  paths = [],
  kerbs = [],
  showWalkable = false,
  route = null,
  selectedId = null,
  onSelect,
  myLocation = null,
  locationStatus = 'idle',
  locationMessage = null,
  onLocate,
  onBoundsChange,
  pinMode = false,
  onPinDrop,
  contributions = [],
  markers = [],
}: Props) {
  // Centre on the first location fix, unless the person has moved on by then.
  const centreOnNextFix = useRef(true)

  // Photos taken within ~30 m of a feature belong to it. Cheap squared-degree
  // comparison: exact distance is not worth the trig at this scale. Worked out
  // once when the data changes, instead of for every pin on every render.
  const photosById = useMemo(() => {
    const NEAR = 0.0003 ** 2
    const out = new Map<string, Contribution[]>()
    const withPhotos = contributions.filter((c) => c.photoUrl)
    if (withPhotos.length === 0) return out
    for (const f of features) {
      const near = withPhotos.filter((c) => (c.lat - f.lat) ** 2 + (c.lng - f.lng) ** 2 < NEAR)
      if (near.length > 0) out.set(f.id, near)
    }
    return out
  }, [features, contributions])
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className={`h-full w-full ${pinMode ? '[&_.leaflet-grab]:cursor-crosshair' : ''}`}
      scrollWheelZoom
      zoomControl={false}
    >
      {/* Sharp to z19; the calm grey look comes from a CSS filter, not a lower-res basemap */}
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={MAX_ZOOM} />

      {/* Bottom-right, out of the side panel's way (like Google Maps) */}
      <ZoomControl position="bottomright" />
      <LocateButton
        position={myLocation}
        status={locationStatus}
        message={locationMessage}
        onLocate={() => {
          centreOnNextFix.current = true
          onLocate?.()
        }}
      />
      <FlyToMe at={myLocation} selectedId={selectedId} pendingRef={centreOnNextFix} />
      <ReportBounds onChange={onBoundsChange} />
      <FlyToSelected feature={features.find((f) => f.id === selectedId)} />
      <PinDropper active={pinMode} onDrop={onPinDrop} />

      {/* Under the pins so markers stay clickable */}
      {showWalkable && <WalkableLayer paths={paths} kerbs={kerbs} />}

      {route && <RouteLayer route={route} />}

      <FeatureLayer features={features} selectedId={selectedId} onSelect={onSelect ?? noop} photosById={photosById} />

      {markers.map((m) => (
        <DroppedPin key={m.id} at={m.at} label={m.label} />
      ))}

    </MapContainer>
  )
}
