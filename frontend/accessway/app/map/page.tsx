import type { Metadata } from 'next'

import { MapView } from './_components/MapView'

export const metadata: Metadata = {
  title: 'Map',
}

/**
 * Deliberately does no data fetching.
 *
 * This used to `await api.getFeatures()` before returning any HTML, so the
 * browser sat on a blank page for as long as OpenStreetMap took to answer —
 * five seconds for an area nobody had loaded yet. Nothing on screen depends on
 * that data being present: the map, the search box and the trip planner are all
 * usable without it.
 *
 * So the shell ships instantly and the tiles fill in underneath it. Perceived
 * latency is what matters here, and a map you can already pan beats a faster
 * number on a page you cannot see.
 */
export default function MapPage() {
  return (
    <main id="main" tabIndex={-1} className="h-dvh outline-hidden">
      <MapView features={[]} />
    </main>
  )
}
