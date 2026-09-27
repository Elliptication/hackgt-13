'use client'

import 'leaflet/dist/leaflet.css'

import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'

import { MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '@/lib/map'
import type { AccessFeature } from '@/types/features'

import { DOT } from './dotColors'

/**
 * A still view of the real map: the same tiles and the same data, with every
 * control turned off. It is a picture of the product rather than an
 * illustration of it — the whole card links through to /map.
 */
export default function HomeMapView({
  center,
  zoom,
  features,
}: {
  center: { lat: number; lng: number }
  zoom: number
  features: AccessFeature[]
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className="h-full w-full"
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={MAX_ZOOM} />
      {features.map((f) => (
        <CircleMarker
          key={f.id}
          center={[f.lat, f.lng]}
          // Entrances outnumber everything else ten to one; smaller, so the
          // elevators and ramps among them can still be seen.
          radius={f.type === 'accessible_entrance' ? 3.5 : 5.5}
          interactive={false}
          pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: DOT[f.type], fillOpacity: 1 }}
        />
      ))}
    </MapContainer>
  )
}
