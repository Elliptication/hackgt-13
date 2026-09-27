'use client'

import 'leaflet/dist/leaflet.css'

import { useCallback, useEffect } from 'react'

import { MapContainer, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet'

import { MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '@/lib/map'
import type { AccessFeature } from '@/types/features'
import type { KerbPoint, PathSegment } from '@/types/paths'
import type { LatLng } from '@/types/places'
import type { Route } from '@/types/routes'
import type { Contribution } from '@/types/contribute'

import { DroppedPin } from './DroppedPin'
import { FeatureMarker } from './FeatureMarker'
import { LocateButton } from './LocateButton'
import { RouteLayer } from './RouteLayer'
import { WalkableLayer } from './WalkableLayer'

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
  onLocated?: (at: LatLng) => void
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
  onLocated,
  onBoundsChange,
  pinMode = false,
  onPinDrop,
  contributions = [],
  markers = [],
}: Props) {
  // Photos taken within ~30 m of a feature belong to it. Cheap squared-degree
  // comparison: exact distance is not worth the trig at this scale.
  const NEAR = 0.0003 ** 2
  const photosFor = (lat: number, lng: number) =>
    contributions.filter((c) => c.photoUrl && (c.lat - lat) ** 2 + (c.lng - lng) ** 2 < NEAR)
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
      <LocateButton onLocated={onLocated} />
      <ReportBounds onChange={onBoundsChange} />
      <FlyToSelected feature={features.find((f) => f.id === selectedId)} />
      <PinDropper active={pinMode} onDrop={onPinDrop} />

      {/* Under the pins so markers stay clickable */}
      {showWalkable && <WalkableLayer paths={paths} kerbs={kerbs} />}

      {route && <RouteLayer route={route} />}

      {features.map((f) => (
        <FeatureMarker
          key={f.id}
          feature={f}
          selected={f.id === selectedId}
          onSelect={(id) => onSelect?.(id)}
          photos={photosFor(f.lat, f.lng)}
        />
      ))}

      {markers.map((m) => (
        <DroppedPin key={m.id} at={m.at} label={m.label} />
      ))}

    </MapContainer>
  )
}
