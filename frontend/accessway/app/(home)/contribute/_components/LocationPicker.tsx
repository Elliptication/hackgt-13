'use client'

import dynamic from 'next/dynamic'

import type { LatLng } from './LocationPickerMap'

export type { LatLng }

// Leaflet touches `window`, so it only renders in the browser
export const LocationPicker = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" aria-hidden="true" />,
})

/** Where maps start before the user picks a spot (Georgia Tech) */
export const DEFAULT_LOCATION: LatLng = { lat: 33.7756, lng: -84.3963 }
