'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

import { MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '@/lib/map'

export type LatLng = { lat: number; lng: number }

type Props = {
  value: LatLng | null
  onChange?: (value: LatLng) => void
  center: LatLng
  /** Show a pin without letting the user move it */
  readOnly?: boolean
}

function ClickToPlace({ onChange }: { onChange: (v: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom())
  }, [center.lat, center.lng, map])
  return null
}

export default function LocationPickerMap({ value, onChange, center, readOnly }: Props) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={17}
      className="h-full w-full"
      scrollWheelZoom={!readOnly}
      dragging={!readOnly}
      zoomControl={!readOnly}
      doubleClickZoom={!readOnly}
      keyboard={!readOnly}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={MAX_ZOOM} />
      <Recenter center={center} />
      {!readOnly && onChange && <ClickToPlace onChange={onChange} />}
      {value && (
        <CircleMarker
          center={[value.lat, value.lng]}
          radius={10}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0b6bcb', fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  )
}
