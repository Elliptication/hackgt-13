import type { Metadata } from 'next'

import { MapView } from './_components/MapView'

export const metadata: Metadata = {
  title: 'Map',
}

export default function MapPage() {
  return (
    <main id="main" tabIndex={-1} className="h-dvh outline-hidden">
      <MapView />
    </main>
  )
}
