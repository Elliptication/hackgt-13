'use client'

import { Check, MapPin, PartyPopper, SkipForward, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/Button'
import { LoginButton } from './LoginButton'
import { LocationPicker } from './LocationPicker'
import { useContributions } from '@/hooks/useContributions'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { accessway, isBackendDown, METRES_PER_MILE, YES_VOTES_TO_VERIFY } from '@/lib/api/accessway'
import { VOTES_TO_APPROVE } from '@/lib/constants'
import { tilesForBbox, tileToCircle } from '@/lib/geo/tiles'
import type { Contribution, Vote } from '@/types/contribute'
import { FEATURE_TYPES } from '@/data/FeatureTypes'

/** A report opened from the map, by its marker id and where it is. */
export type ReviewFocus = { featureId: string; lat: number; lng: number }

type FocusState = 'loading' | 'ready' | 'missing' | 'unvotable' | 'down' | 'failed'

const COMMUNITY = 'community-'
const LOCAL = 'contribution-'

/**
 * Finds the report a map marker link points at and puts it in the queue.
 *
 * Map markers from the API are `community-<feature id>`. The API only looks
 * features up by area, so this asks for the same cell the map loaded it from
 * and picks it out by id. Markers for photos added in this tab are
 * `contribution-<id>` and are already in the queue.
 */
function useFocusedReport(focus: ReviewFocus | null): { id: string | null; state: FocusState | null } {
  const { contributions, adopt } = useContributions()
  const featureId = focus?.featureId ?? ''
  const communityId = featureId.startsWith(COMMUNITY) ? featureId.slice(COMMUNITY.length) : null
  const localId = featureId.startsWith(LOCAL) ? featureId.slice(LOCAL.length) : null
  const id = localId ?? (communityId && `${COMMUNITY}${communityId}`)
  const known = !!id && contributions.some((c) => c.id === id)
  const [state, setState] = useState<FocusState>('loading')

  const lat = focus?.lat
  const lng = focus?.lng
  useEffect(() => {
    if (!communityId || known || lat === undefined || lng === undefined) return
    const controller = new AbortController()
    const [tile] = tilesForBbox({ south: lat, north: lat, west: lng, east: lng })
    const circle = tileToCircle(tile)

    accessway
      .getFeatures(
        { lat: circle.lat, lng: circle.lng, radiusMiles: Number((circle.radius / METRES_PER_MILE).toFixed(4)) },
        controller.signal,
      )
      .then((found) => {
        const f = found.find((x) => x.featureId === communityId)
        if (!f) return setState('missing')
        // A vote is cast against the contribution; without one there is nothing to vote on.
        if (!f.contributionId) return setState('unvotable')
        const report: Contribution = {
          id: `${COMMUNITY}${communityId}`,
          type: f.type,
          name: f.name,
          lat: f.lat,
          lng: f.lng,
          photoUrl: f.photoUrl,
          // The API does not say who added it, only that it was not this tab.
          submittedBy: 'community',
          submittedAt: Date.now(),
          confirms: f.report?.yes ?? YES_VOTES_TO_VERIFY,
          rejects: 0,
          needed: YES_VOTES_TO_VERIFY,
          status: f.verified ? 'approved' : 'pending',
          contributionId: f.contributionId,
          featureId: f.featureId,
        }
        adopt(report)
        setState('ready')
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState(isBackendDown(err) ? 'down' : 'failed')
      })
    return () => controller.abort()
  }, [communityId, known, lat, lng, adopt])

  if (!focus) return { id: null, state: null }
  if (known) return { id, state: 'ready' }
  if (!id) return { id: null, state: 'missing' }
  return { id, state: localId ? 'missing' : state }
}

const FOCUS_MESSAGE: Partial<Record<FocusState, string>> = {
  loading: 'Finding that report…',
  missing: 'Couldn’t find that report — it may have been removed.',
  unvotable: 'That report can’t be voted on yet.',
  down: 'The AccessWay API isn’t answering, so that report can’t be loaded right now.',
  failed: 'Couldn’t load that report. Try again in a moment.',
}

export function ReviewQueue({ focus = null }: { focus?: ReviewFocus | null }) {
  const { contributions, userId, myVotes, vote, syncError } = useContributions()
  const requireAuth = useRequireAuth()
  // Not asked for: the queue falls back to campus when there is no fix.
  const { position } = useGeolocation({ auto: false })
  const [lastVote, setLastVote] = useState<Vote | null>(null)
  const focused = useFocusedReport(focus)

  // Nobody should be asked to judge their own photo. This covers uploads from
  // this session; the queue also matches on the uploader's id from the API.
  const mine = useMemo(
    () => new Set(contributions.map((c) => c.featureId).filter((id): id is string => !!id)),
    [contributions],
  )
  // The report opened from the map goes first, until it's voted on or skipped.
  const fromMap = queue.find((c) => c.id === focused.id)
  const current = fromMap ?? queue[0]
  const fromMapDone = focused.state === 'ready' && focused.id && !fromMap
  const focusNote = fromMapDone
    ? myVotes[focused.id!]
      ? 'You’ve already voted on that report.'
      : contributions.find((c) => c.id === focused.id)?.status === 'approved'
        ? 'That report is already confirmed.'
        : null
    : focused.state && FOCUS_MESSAGE[focused.state]
  const reviewedCount = Object.keys(myVotes).length

  const {
    queue,
    reviewed,
    loading,
    loadingContext,
    error,
    unavailable,
    bucketUnconfigured,
    voteError,
    pending,
    vote,
    skip,
    refresh,
  } = useReviewQueue({ centre: position, exclude: mine, viewerId: userId })

  const current = queue[0]

  async function cast(item: ReviewItem, v: Vote) {
    // Signed out? This sends them to log in and brings them back here after.
    if (!requireAuth() || !userId) return

    // Nothing is claimed until the API agrees. This used to announce "Thanks,
    // confirmed!" before the request was even sent, so a vote that was refused
    // still read as counted — next to the error explaining it had not been.
    const counted = await vote(item, v, userId)
    if (counted) setLastVote(v)
  }

  // Only known once `/features` answers. Until then the card asks the neutral
  // question rather than guessing at a type it does not have.
  const kind = current?.type ? FEATURE_TYPES[current.type] : null

  /** This card's vote is in flight. Compared by id, not a bare boolean, so a
      request left over from the previous card cannot freeze this one. */
  const sending = pending !== null && pending === current?.contributionId

  return (
    <div className="mx-auto max-w-2xl">
      <header className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Is this right?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Help check what people have added. Enough confirmations and it goes on the map for everyone.
        </p>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {reviewed > 0 && `You’ve reviewed ${reviewed}. `}
          {queue.length > 0 && `${queue.length} left to review.`}
        </p>
      </header>

      {focusNote && (
        <p role="status" className="mx-auto mt-4 w-fit rounded-full bg-surface px-4 py-1.5 text-sm text-muted ring-1 ring-border/60">
          {focusNote}
        </p>
      )}

      {current ? (
        <article
          key={current.contributionId}
          className="mt-8 overflow-hidden rounded-3xl bg-background shadow-[0_8px_30px_-12px_rgb(15_15_15/0.18)] ring-1 ring-border"
          aria-labelledby="review-name"
        >
          {fromMap && (
            <p className="flex items-center gap-1.5 bg-primary-soft px-5 py-2 text-sm font-medium">
              <MapPin className="size-4" aria-hidden="true" /> The report you picked on the map
            </p>
          )}
          <ContributionPhoto contribution={current} className="aspect-[4/3] w-full" />

          <div className="p-5 sm:p-6">
            {(() => {
              const { label, icon: Icon, color, bg } = FEATURE_TYPES[current.type]
              return (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                  style={{ background: bg }}
                >
                  <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
                  {label}
                </span>
              )
            })()}
            <h2 id="review-name" className="mt-3 text-xl font-bold">
              {current.name}
            </h2>

            <h2 id="review-name" className="mt-3 text-xl font-bold">
              {current.name ?? 'Someone’s photo'}
            </h2>
            {current.description && (
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{current.description}</p>
            )}
            <p className="mt-1 text-xs text-subtle">
              Uploaded {new Date(current.uploadedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>

            {current.lat !== null && current.lng !== null && (
              <div
                className="mt-4 h-36 overflow-hidden rounded-2xl ring-1 ring-border"
                aria-label="Location on map"
                role="img"
              >
                <LocationPicker
                  value={{ lat: current.lat, lng: current.lng }}
                  center={{ lat: current.lat, lng: current.lng }}
                  readOnly
                />
              </div>
            )}

            <p className="mt-5 text-center font-medium">
              {kind ? `Is there ${withArticle(kind.label.toLowerCase())} here?` : 'Does this photo show something useful?'}
            </p>
            {userId ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cast(current, 'reject')}
                  disabled={sending}
                  aria-busy={sending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--tag-red-bg)] font-medium transition hover:brightness-[0.97] disabled:opacity-60 motion-safe:active:scale-[0.98] disabled:motion-safe:active:scale-100"
                >
                  {sending ? (
                    <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <X className="size-5 text-[var(--tag-red)]" aria-hidden="true" />
                  )}
                  Not right
                </button>
                <button
                  type="button"
                  onClick={() => cast(current, 'confirm')}
                  disabled={sending}
                  aria-busy={sending}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--tag-green-bg)] font-medium transition hover:brightness-[0.97] disabled:opacity-60 motion-safe:active:scale-[0.98] disabled:motion-safe:active:scale-100"
                >
                  {sending ? (
                    <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="size-5 text-[var(--tag-green)]" aria-hidden="true" />
                  )}
                  Looks right
                </button>
              </div>
            ) : (
              <LoginButton className="mt-3 w-full">Log in to vote</LoginButton>
            )}

            {/* A vote is allowed a 20 second budget and three attempts, so
                without this the buttons sit silent for up to a minute and the
                click reads as having done nothing at all. */}
            {sending && (
              <p role="status" className="mt-2 text-center text-xs text-muted">
                Sending your vote…
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                // Otherwise the green "your vote was counted" banner stays up
                // over a card nobody voted on.
                setLastVote(null)
                skip(current)
              }}
              disabled={sending}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-foreground disabled:opacity-60"
            >
              <SkipForward className="size-3.5" aria-hidden="true" /> Not sure, skip
            </button>

            <p className="mt-4 text-center text-xs text-muted">
              {current.confirms} of {current.needed ?? VOTES_TO_APPROVE} confirmations so far
            </p>

            {/* A vote counted here that the API refused. Said once, not per photo. */}
            {syncError && (
              <p role="status" className="mt-3 rounded-2xl bg-[var(--tag-yellow-bg)] px-3 py-2 text-center text-xs">
                {voteError}
              </p>
            )}
          </div>
        </article>
      ) : (
        !loading &&
        !unavailable &&
        !error && (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-14 text-center ring-1 ring-border/60">
            <span className="grid size-14 place-items-center rounded-full bg-[var(--tag-yellow-bg)]">
              <PartyPopper className="size-7 text-[var(--tag-yellow)]" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold">All caught up!</h2>
            <p className="max-w-sm text-muted">
              Nothing waiting nearby. Want to earn some change? Add one of your own.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button href="/contribute?tab=add" size="md">
                Add a photo
              </Button>
              {reviewed > 0 && (
                <button
                  type="button"
                  onClick={refresh}
                  className="inline-flex h-9 items-center rounded-full bg-primary-soft px-4 text-sm font-medium hover:brightness-[0.97]"
                >
                  Check again
                </button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/** "a ramp", "an elevator" */
function withArticle(noun: string) {
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
}
