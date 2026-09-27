'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

import { FEATURE_TYPES } from '@/data/FeatureTypes'
import { useFeatures } from '@/hooks/useFeatures'
import type { FeatureType } from '@/types/features'

import { DOT } from './dotColors'

const HomeMapView = dynamic(() => import('./HomeMapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface" aria-hidden="true" />,
})

/**
 * East side of Georgia Tech. Picked by counting what the map actually has:
 * this is the densest view around campus with all four kinds in it.
 */
const CENTER = { lat: 33.776, lng: -84.392 }
const ZOOM = 16
/** Roughly what a 16 view of the card shows, so the counts match the picture. */
const VIEW = { west: CENTER.lng - 0.009, south: CENTER.lat - 0.0055, east: CENTER.lng + 0.009, north: CENTER.lat + 0.0055 }
const BBOX = [VIEW.west, VIEW.south, VIEW.east, VIEW.north].join(',')

const COUNTED: FeatureType[] = ['accessible_entrance', 'elevator', 'ramp', 'restroom']

export function HomeMap() {
  const { features: loaded, loading } = useFeatures(BBOX, ZOOM)
  // Data arrives by the tile, and tiles overhang the card. The caption says
  // "in this view", so only what is actually in view is drawn or counted.
  const features = useMemo(
    () => loaded.filter((f) => f.lat >= VIEW.south && f.lat <= VIEW.north && f.lng >= VIEW.west && f.lng <= VIEW.east),
    [loaded],
  )
  // A zero reads as "there are none", which is not what an unmapped kind means.
  const counts = COUNTED.map((type) => ({ type, n: features.filter((f) => f.type === type).length })).filter((c) => c.n > 0)
  const total = counts.reduce((sum, c) => sum + c.n, 0)

  return (
    <figure className="isolate overflow-hidden rounded-xl bg-background ring-1 ring-border">
      <Link
        href="/map"
        className="group relative block h-72 sm:h-96"
        aria-label="Open the full map, starting around Georgia Tech"
      >
        <HomeMapView center={CENTER} zoom={ZOOM} features={features} />
        <span className="absolute top-3 right-3 z-[500] inline-flex items-center gap-1 rounded-md bg-background px-2.5 py-1.5 text-sm font-medium shadow-sm ring-1 ring-border transition-colors group-hover:bg-hover">
          Open map <ArrowUpRight className="size-4" aria-hidden="true" />
        </span>
      </Link>

      <figcaption className="border-t border-border px-4 py-3 text-sm">
        {loading && total === 0 ? (
          <span className="text-muted">Loading what’s mapped around Georgia Tech…</span>
        ) : total === 0 ? (
          <span className="text-muted">Around Georgia Tech. Nothing mapped in this view yet.</span>
        ) : (
          <>
            <span className="text-muted">Mapped in this view of Georgia Tech</span>
            <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
              {counts.map(({ type, n }) => (
                <li key={type} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: DOT[type] }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{n}</span>
                  <span className="text-muted">{FEATURE_TYPES[type].plural.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </figcaption>
    </figure>
  )
}
