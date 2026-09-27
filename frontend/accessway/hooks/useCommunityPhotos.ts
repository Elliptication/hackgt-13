'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { accessway, contributionPhotoUrl, isBackendDown, SUPABASE_URL } from '@/lib/api/accessway'
import type { ContributionRow } from '@/types/accessway'

/**
 * The photos behind what people have added.
 *
 * `GET /features` describes a community feature but says nothing about its
 * photo, and `GET /contributions/` returns the photo but says nothing about
 * where it is. Neither is usable alone, so this hook holds the second one and
 * keys it by `feature_id` — the column the two share — for callers that already
 * have features in hand.
 *
 * One fetch for the whole table, once per mount. That is not laziness: the
 * endpoint takes no bbox, no limit and no cursor, so paging it by area is not
 * something a client can do. It stays honest while the table is small and turns
 * into the wrong shape the moment it is not — see REVIEWS-API.md.
 */

export type CommunityPhoto = {
  /** The contribution row's own id. Also what a vote is cast against. */
  id: string
  /** Resolved public URL, or undefined when the bucket is not configured. */
  photoUrl?: string
  /** Google `sub` of the uploader, for keeping people off their own photos. */
  userId: string
  uploadedAt: number
}

/** Photos for one feature, newest first. */
export type PhotosByFeature = Map<string, CommunityPhoto[]>

const NONE: PhotosByFeature = new Map()

function toPhoto(row: ContributionRow): CommunityPhoto {
  return {
    id: String(row.id),
    photoUrl: contributionPhotoUrl(row.image_path),
    userId: row.user_id,
    uploadedAt: Date.parse(row.created_at),
  }
}

export function useCommunityPhotos() {
  const [rows, setRows] = useState<ContributionRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [round, setRound] = useState(0)

  // Guards the StrictMode double-invoke in development, which would otherwise
  // fetch the whole table twice on every mount.
  const inFlight = useRef(false)

  useEffect(() => {
    if (inFlight.current) return
    inFlight.current = true

    const controller = new AbortController()
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const found = await accessway.listContributions(controller.signal)
        if (cancelled) return
        setRows(found)
        setError(null)
        setUnavailable(false)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setRows([])
        setUnavailable(isBackendDown(err))
        setError(isBackendDown(err) ? null : err instanceof Error ? err.message : 'Could not load photos.')
      } finally {
        inFlight.current = false
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      inFlight.current = false
      controller.abort()
    }
  }, [round])

  const byFeatureId = useMemo(() => {
    if (!rows?.length) return NONE
    const out: PhotosByFeature = new Map()
    for (const row of rows) {
      if (!row.image_path) continue
      const key = String(row.feature_id)
      const list = out.get(key)
      if (list) list.push(toPhoto(row))
      else out.set(key, [toPhoto(row)])
    }
    for (const list of out.values()) list.sort((a, b) => b.uploadedAt - a.uploadedAt)
    return out
  }, [rows])

  return {
    /** Photos keyed by the backend's raw `feature_id`. */
    byFeatureId,
    /** Every photo row, newest first — for showing uploads the map cannot place. */
    all: useMemo(
      () => (rows ?? []).filter((r) => r.image_path).map(toPhoto).sort((a, b) => b.uploadedAt - a.uploadedAt),
      [rows],
    ),
    loading,
    error,
    unavailable,
    /**
     * True when photos exist but `NEXT_PUBLIC_SUPABASE_URL` is unset, so every
     * `photoUrl` is undefined. A silently image-less gallery is indistinguishable
     * from an empty one, so callers can say which it is.
     */
    bucketUnconfigured: !SUPABASE_URL,
    refresh: useCallback(() => setRound((n) => n + 1), []),
  }
}
