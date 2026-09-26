import type { Metadata } from 'next'

import { MapView } from './_components/MapView'
import { SAMPLE_FEATURES } from '@/data/SampleFeatures'

export const metadata: Metadata = {
  title: 'Map',
}

// Full-screen map: header only, no footer
export default function MapPage() {
  return (
    <main id="main" tabIndex={-1} className="h-dvh outline-hidden">
      <MapView features={SAMPLE_FEATURES} />
    </main>
  )
}
