'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'

import { FEATURE_TYPES, type AccessFeature } from '@/lib/features'

const DEFAULT_CENTER: [number, number] = [33.7756, -84.3963] // Georgia Tech
const DEFAULT_ZOOM = 16

type Props = {
  features: AccessFeature[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** SVG attributes can't use CSS variables, so resolve `var(--x)` to its current value */
function resolveCssColor(value: string) {
  const match = value.match(/^var\((--[^)]+)\)$/)
  if (!match) return value
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || '#787774'
}

function FlyToSelected({ feature }: { feature?: AccessFeature }) {
  const map = useMap()
  useEffect(() => {
    if (feature) map.flyTo([feature.lat, feature.lng], Math.max(map.getZoom(), 17), { duration: 0.6 })
  }, [feature, map])
  return null
}

export default function LeafletMap({ features, selectedId, onSelect }: Props) {
  const [colors, setColors] = useState<Record<string, string>>({})

  // Resolve the CSS-variable tag colors once the page is in the browser
  useEffect(() => {
    setColors(Object.fromEntries(Object.entries(FEATURE_TYPES).map(([k, v]) => [k, resolveCssColor(v.color)])))
  }, [])

  const selected = features.find((f) => f.id === selectedId)

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FlyToSelected feature={selected} />

      {features.map((f) => {
        const color = colors[f.type] ?? '#787774'
        const isSelected = f.id === selectedId
        return (
          <CircleMarker
            key={f.id}
            center={[f.lat, f.lng]}
            radius={isSelected ? 11 : 8}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: color,
              fillOpacity: 1,
              dashArray: f.status === 'reported-issue' ? '3 3' : undefined,
            }}
            eventHandlers={{ click: () => onSelect(f.id) }}
          >
            <Popup>
              <strong className="block text-sm">{f.name}</strong>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {FEATURE_TYPES[f.type].label}
                {f.status === 'reported-issue' && ' · Reported issue'}
              </span>
              {f.description && <p className="!my-1 text-sm">{f.description}</p>}
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
