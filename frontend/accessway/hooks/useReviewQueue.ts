'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { accessway, ACCESSWAY_API_URL, isBackendDown, type CommunityFeature } from '@/lib/api/accessway'
import type { Vote } from '@/types/contribute'
import type { FeatureType } from '@/types/features'

import { useCommunityPhotos, type CommunityPhoto } from './useCommunityPhotos'

/**
 * What is waiting on the community, built from the photos rather than the map.
 *
 * This used to derive the queue from `GET /features`, which reads better but
 * does not work: a review is a judgement about a *photo*, and `/features` never
 * returns one. It is also the endpoint currently answering `[]` for every point
 * and radius, so sourcing from it meant an empty queue while three real uploads
 * sat in the table.
 *
 * So `GET /contributions/` leads. Every row there is a photo somebody uploaded,
 * and it carries the contribution id — which is the only thing `POST /vote/`
 * actually needs. `/features` is then joined in for the type, the name and the
 * location, and its absence costs context on the card but never the vote.
 *
 * Still missing server-side: the running tally, and the two exclusions that
 * belong on the server (own photos, already-voted). See REVIEWS-API.md.
 */

/** Georgia Tech. Where the queue looks when we have no fix on the user. */
const DEFAULT_CENTRE = { lat: 33.7756, lng: -84.3963 }

/**
 * Wide enough to find something to review on a campus-sized deployment.
 * The endpoint takes miles — it divides by 69 to reach degrees, which is only
 * true for miles.
 */
const RADIUS_MILES = 3

/**
 * Ceiling on per-id feature lookups in one pass.
 *
 * `GET /contributions/` is unbounded, so the number of photos is not a number
 * this hook controls. Without a cap, a table that has grown would fire one
 * request per row the area search missed.
 */
const MAX_LOOKUPS = 24

export type ReviewItem = {
  /** What the vote is cast against. Always present — it is why the row exists. */
  contributionId: string
  /** The feature the upload created. Present even when `/features` cannot find it. */
  featureId: string
  photoUrl?: string
  /** Google `sub` of the uploader. Null on a row not created by the upload flow. */
  uploadedBy: string | null
  uploadedAt: number
  /**
   * From `/features`, when the join lands. Null means the API knows the photo
   * exists but cannot say where or what it is — the card adapts rather than
   * inventing a type.
   */
  type: FeatureType | null
  name: string | null
  description?: string
  lat: number | null
  lng: number | null
}

/** A photo joined to whatever `/features` could tell us about it. */
function toReviewItem(featureId: string, photo: CommunityPhoto, feature?: CommunityFeature): ReviewItem {
  return {
    contributionId: photo.id,
    featureId,
    photoUrl: photo.photoUrl,
    uploadedBy: photo.userId,
    uploadedAt: photo.uploadedAt,
    type: feature?.type ?? null,
    name: feature?.name ?? null,
    description: feature?.description,
    lat: feature?.lat ?? null,
    lng: feature?.lng ?? null,
  }
}

export function useReviewQueue({
  centre,
  /** Feature ids the signed-in user uploaded, so they are not asked to judge their own. */
  exclude,
  /** The signed-in user, so their own uploads drop out of the queue. */
  viewerId,
}: {
  centre?: { lat: number; lng: number } | null
  exclude?: Set<string>
  viewerId?: string | null
} = {}) {
  const { byFeatureId: photos, loading: loadingPhotos, unavailable: photosDown, error: photosError, refresh: refreshPhotos, bucketUnconfigured } =
    useCommunityPhotos()

  /** `/features` by raw feature id, for the context the photo rows lack. */
  const [features, setFeatures] = useState<Map<string, CommunityFeature>>(() => new Map())
  const [loadingFeatures, setLoadingFeatures] = useState(true)

  /** Judged or skipped in this session: gone from the queue, either way. */
  const [settled, setSettled] = useState<Set<string>>(() => new Set())
  const [voteError, setVoteError] = useState<string | null>(null)
  /**
   * The contribution whose vote is in flight.
   *
   * A vote gets a 20 second budget and is retried up to three times, so a
   * failing one can take the better part of a minute. Without this the button
   * looks inert for all of it, and the only visible result is the card coming
   * back long after the click — which reads as the click having done nothing.
   */
  const [pending, setPending] = useState<string | null>(null)

  const at = centre ?? DEFAULT_CENTRE
  // Quantised, so a metre of GPS drift is not a refetch.
  const lat = Number(at.lat.toFixed(3))
  const lng = Number(at.lng.toFixed(3))

  /** Bumped to refetch after the queue empties. */
  const [round, setRound] = useState(0)
  const inFlight = useRef(false)

  // The features the photos point at, as one string. A Map gets a new identity
  // on every fetch even when its keys are unchanged, so the effect keys off the
  // contents instead — and reads them back out, so there is no second
  // dependency that has to be kept in step with this one.
  const wantedKey = useMemo(() => [...photos.keys()].join(','), [photos])

  useEffect(() => {
    if (inFlight.current) return
    inFlight.current = true

    const controller = new AbortController()
    let cancelled = false

    ;(async () => {
      setLoadingFeatures(true)
      const found = new Map<string, CommunityFeature>()

      // One bulk call first: cheapest when it works, and it covers everything
      // in the area at once.
      try {
        const nearby = await accessway.getFeatures({ lat, lng, radiusMiles: RADIUS_MILES }, controller.signal)
        for (const f of nearby) found.set(f.featureId, f)
      } catch {
        // Swallowed on purpose. `/features` supplies only the type, name and
        // location; losing it degrades the card but must never empty the queue,
        // which is exactly the bug this hook was rewritten to fix.
      }

      // Then fill the gaps by id. This is what makes the queue work while the
      // radius query is returning nothing — a photo row knows its feature id
      // even when no area search can find it.
      const wanted = wantedKey ? wantedKey.split(',') : []
      const missing = wanted.filter((id) => !found.has(id)).slice(0, MAX_LOOKUPS)
      if (missing.length > 0) {
        const resolved = await Promise.all(
          missing.map((id) => accessway.getFeature(id, controller.signal).catch(() => null)),
        )
        for (const f of resolved) if (f) found.set(f.featureId, f)
      }

      if (cancelled) return
      setFeatures(found)
      inFlight.current = false
      setLoadingFeatures(false)
    })()

    return () => {
      cancelled = true
      inFlight.current = false
      controller.abort()
    }
  }, [lat, lng, round, wantedKey])

  /**
   * Every uploaded photo that still needs judging, oldest first — whoever has
   * been waiting longest goes to the front.
   *
   * The two exclusions here are courtesy, not enforcement: a signed-out reader
   * has no `viewerId`, and "already voted" is only known for this session. Both
   * belong on the server (REVIEWS-API.md §3), which is also the only place they
   * survive a reload.
   */
  const queue = useMemo(() => {
    const out: ReviewItem[] = []

    for (const [featureId, shots] of photos) {
      if (exclude?.has(featureId)) continue
      // Anything already past the threshold is on the map, not in review.
      if (features.get(featureId)?.verified) continue

      for (const shot of shots) {
        if (settled.has(shot.id)) continue
        if (viewerId && shot.userId === viewerId) continue
        out.push(toReviewItem(featureId, shot, features.get(featureId)))
      }
    }

    return out.sort((a, b) => a.uploadedAt - b.uploadedAt)
  }, [photos, features, settled, exclude, viewerId])

  /**
   * Cast a vote, and drop the card once it has actually been counted.
   *
   * The card used to be removed the moment the button was pressed, on the
   * reasoning that the next photo should appear immediately. That turned out to
   * be the wrong trade. On the last card in the queue it read as: the card
   * vanishes, "All caught up!" appears, and then the card comes back when the
   * request fails — which is indistinguishable from the click having done
   * nothing, and is worse the slower the network is.
   *
   * So the card now stays put with a spinner and leaves only on success. The
   * wait is visible instead of hidden, and what is on screen is always the truth
   * about what the server has been told.
   */
  const vote = useCallback(async (item: ReviewItem, choice: Vote, userId: string) => {
    setVoteError(null)
    setPending(item.contributionId)
    try {
      await accessway.vote({
        contributionId: item.contributionId,
        userId,
        upvote: choice === 'confirm',
      })
      setSettled((s) => new Set(s).add(item.contributionId))
      return true
    } catch (err) {
      setVoteError(voteMessage(err))
      return false
    } finally {
      setPending(null)
    }
  }, [])

  const skip = useCallback(
    (item: ReviewItem) => setSettled((s) => new Set(s).add(item.contributionId)),
    [],
  )

  /** Ask the API again — for after the queue is emptied. */
  const refresh = useCallback(() => {
    setSettled(new Set())
    setRound((n) => n + 1)
    refreshPhotos()
  }, [refreshPhotos])

  return {
    queue,
    /** How many this session has judged or skipped. */
    reviewed: settled.size,
    /** The photos are what the queue is made of, so only they gate the spinner. */
    loading: loadingPhotos,
    /** True while `/features` is still filling in the type and location. */
    loadingContext: loadingFeatures,
    error: photosError,
    unavailable: photosDown,
    /** Photos exist but NEXT_PUBLIC_SUPABASE_URL is unset, so none can be shown. */
    bucketUnconfigured,
    voteError,
    /** Contribution id whose vote is still in flight, if any. */
    pending,
    vote,
    skip,
    refresh,
  }
}

/**
 * Why a vote did not count, in words that point at the fix.
 *
 * 401 is the one worth spelling out, because "log in again" is the wrong advice
 * and sends people in circles. `POST /vote/` is behind `get_current_user`, the
 * session is a cookie on api.accessway.tech set `SameSite=lax`, and a request
 * from a different site never carries a Lax cookie — so on a dev origin the
 * vote is refused no matter how many times you sign in. It needs
 * `SameSite=None; Secure` on the backend before cross-site voting can work.
 */
function voteMessage(err: unknown) {
  if (isBackendDown(err)) return 'The AccessWay API isn’t answering, so your vote wasn’t counted.'
  const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : null

  if (status === 401) {
    return isCrossSite()
      ? 'The API didn’t receive your session. Its cookie is SameSite=lax, which browsers withhold from a different site — it needs SameSite=None; Secure to accept votes from here.'
      : 'The API didn’t recognise your session, so your vote wasn’t counted. Try logging in again.'
  }
  if (status === 404) return 'The API has no feature for this photo, so there’s nothing to vote on.'

  return `${err instanceof Error ? err.message : 'Something went wrong.'} Your vote wasn’t counted.`
}

/**
 * Whether this page and the API are different sites — which is the only case
 * where a `SameSite=lax` cookie is withheld.
 *
 * Compared on the last two labels, so `www.accessway.tech` and
 * `api.accessway.tech` are correctly same-site: both sit under
 * `accessway.tech`, and a Lax cookie travels freely between them. Sibling
 * subdomains are exactly the case a prefix or suffix test gets wrong.
 *
 * Two labels is an approximation of the public suffix list, not a substitute —
 * it would call `a.co.uk` and `b.co.uk` same-site. That is acceptable here
 * because the only thing downstream is which of two error messages to show.
 */
function isCrossSite() {
  if (typeof window === 'undefined') return false
  try {
    const api = new URL(ACCESSWAY_API_URL, window.location.origin).hostname
    const here = window.location.hostname
    if (api === here) return false
    return site(api) !== site(here)
  } catch {
    return false
  }
}

/** "api.accessway.tech" → "accessway.tech"; "localhost" stays itself. */
function site(hostname: string) {
  return hostname.split('.').slice(-2).join('.')
}
