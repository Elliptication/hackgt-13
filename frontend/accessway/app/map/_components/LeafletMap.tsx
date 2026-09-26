'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet'

import { FEATURE_TYPES } from '@/data/FeatureTypes'
import type { AccessFeature } from '@/types/features'
import { MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '@/lib/map'

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
  // This component only renders in the browser, so the CSS variables can be read right away
  const [colors] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(FEATURE_TYPES).map(([k, v]) => [k, resolveCssColor(v.color)])),
  )

  const selected = features.find((f) => f.id === selectedId)

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom zoomControl={false}>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={MAX_ZOOM} />
      {/* Bottom-right, out of the side panel’s way (like Google Maps) */}
      <ZoomControl position="bottomright" />
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
              {f.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- community upload
                <img src={f.photoUrl} alt={f.description ?? f.name} className="mb-2 aspect-[4/3] w-52 rounded-lg object-cover" />
              )}
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
