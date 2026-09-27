'use client'

import { useMemo } from 'react'

import type { AccessFeature } from '@/types/features'

import { useTiledData } from './useTiledData'

/**
 * Lifts, step-free entrances and accessible restrooms, loaded tile by tile.
 *
 * The server render seeds the opening view so the first paint is instant; tiles
 * fill in around it as the map moves, and nothing is ever taken away.
 */
export function useFeatures(initial: AccessFeature[], bbox: string | null, zoom: number | null) {
  const { bodies, loading, error, tilesLoaded, tooFarOut, noBackend } = useTiledData<{ items: AccessFeature[] }>('features', bbox, zoom)

  const features = useMemo(() => {
    // Until the first tile lands, show what the server already gave us.
    if (tilesLoaded === 0) return initial
    // A feature sitting on a tile edge is returned by both neighbours, so the
    // union has to be keyed by id or React sees duplicate keys.
    return [...new Map(bodies.flatMap((b) => b.items).map((f) => [f.id, f])).values()]
  }, [tilesLoaded, bodies, initial])

  return { features, loading, error, tooFarOut, noBackend }
}
