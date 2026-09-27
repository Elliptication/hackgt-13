'use client'

import { useMemo } from 'react'

import { isFeatureType, toFeatureType } from '@/data/FeatureTypes'
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
    // A tile cached before a type was renamed can still carry the old name.
    const items = bodies.flatMap((b) => b.items).map((f) => (isFeatureType(f.type) ? f : { ...f, type: toFeatureType(f.type) }))
    return [...new Map(items.map((f) => [f.id, f])).values()]
  }, [tilesLoaded, bodies])

  return { features, loading, error, tooFarOut, noBackend }
}
