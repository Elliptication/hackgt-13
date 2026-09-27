'use client'

import L from 'leaflet'
import { useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'

import type { LatLng } from '@/types/places'

/**
 * Where a dropped point actually landed.
 *
 * Without this, tapping the map filled a text field and nothing visible
 * happened — you had to trust that the coordinates matched where you meant.
 * Seeing the pin is what makes dropping one feel like placing something.
 *
 * Deliberately a different shape from the feature pins: this is a location
 * someone chose, not something we know about.
 */
function pinIcon(label: string) {
  const html = `
    <div style="position:relative;width:26px;height:34px;">
      <div style="
        position:absolute;inset:0 0 8px 0;
        border-radius:50% 50% 50% 50%;
        background:var(--foreground);
        border:2.5px solid #ffffff;
        box-shadow:0 2px 6px rgb(15 15 15 / 0.4);
        display:grid;place-items:center;
      ">
        <div style="width:7px;height:7px;border-radius:50%;background:#ffffff;"></div>
      </div>
      <div style="
        position:absolute;left:50%;bottom:0;
        width:0;height:0;margin-left:-4px;
        border-left:4px solid transparent;
        border-right:4px solid transparent;
        border-top:9px solid #ffffff;
      "></div>
    </div>`

  return L.divIcon({
    html,
    className: 'accessway-dropped-pin',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  })
}

export function DroppedPin({ at, label }: { at: LatLng; label: string }) {
  const icon = useMemo(() => pinIcon(label), [label])

  return (
    <Marker position={[at.lat, at.lng]} icon={icon} alt={label} keyboard={false}>
      <Tooltip direction="top" offset={[0, -30]}>
        {label}
      </Tooltip>
    </Marker>
  )
}
