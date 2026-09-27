'use client'

import { useMemo } from 'react'

import type { KerbPoint, PathSegment } from '@/types/paths'

import { useTiledData } from './useTiledData'

type PathsBody = { items: PathSegment[]; kerbs: KerbPoint[] }

/** Drop rows that two neighbouring tiles both returned. */
function byId<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((r) => [r.id, r])).values()]
}

/**
 * The sidewalk network, loaded tile by tile and only once the layer is on.
 *
 * It is by far the heaviest thing we fetch, so paying for it on every page load
 * would slow the map down for everyone who never switches it on. Paths and
 * kerbs arrive in one response, so this costs a single request per tile.
 */
export function useWalkable(enabled: boolean, bbox: string | null, zoom: number | null) {
  const { bodies, loading, error, tooFarOut } = useTiledData<PathsBody>('paths', bbox, zoom, enabled)

  const paths = useMemo(() => byId(bodies.flatMap((b) => b.items ?? [])), [bodies])
  const kerbs = useMemo(() => byId(bodies.flatMap((b) => b.kerbs ?? [])), [bodies])

  return { paths, kerbs, loading, error, tooFarOut }
}
