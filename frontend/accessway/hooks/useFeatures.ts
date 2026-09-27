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
export function useFeatures(bbox: string | null, zoom: number | null) {
  const { bodies, loading, error, tilesLoaded, tooFarOut, noBackend } = useTiledData<{ items: AccessFeature[] }>('features', bbox, zoom)

  const features = useMemo(() => {
    return [...new Map(bodies.flatMap((b) => b.items).map((f) => [f.id, f])).values()]
  }, [tilesLoaded, bodies])

  return { features, loading, error, tooFarOut, noBackend }
}
