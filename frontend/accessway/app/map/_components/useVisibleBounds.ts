'use client'

import type { LatLngBounds } from 'leaflet'
import { useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'

/**
 * The part of the map on screen (plus a margin) and the zoom level, updated
 * when a pan or zoom ends.
 *
 * Layers use it to draw only what can be seen, and to pick how much detail to
 * draw. Data is never dropped, so after browsing a few neighbourhoods the app
 * can hold thousands of points; drawing all of them made every pan stutter.
 *
 * `pad` is how much extra to include on each side, as a fraction of the view:
 * 0.5 means half a screen, so a short pan never shows an empty edge.
 */
export function useVisibleBounds(pad = 0.5): { bounds: LatLngBounds; zoom: number } {
  const map = useMap()
  const [view, setView] = useState(() => ({ bounds: map.getBounds().pad(pad), zoom: map.getZoom() }))

  useMapEvents({
    // Zooming ends with a moveend too, so this one event covers both.
    moveend: () => setView({ bounds: map.getBounds().pad(pad), zoom: map.getZoom() }),
  })

  return view
}
