'use client'

/* eslint-disable @next/next/no-img-element -- community uploads from the storage bucket */
import { Check, ImageIcon, LoaderCircle, MapPin, PartyPopper, SkipForward, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import { useContributions } from '@/hooks/useContributions'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useReviewQueue, type ReviewItem } from '@/hooks/useReviewQueue'
import type { Vote } from '@/types/contribute'

import { LocationPicker } from './LocationPicker'
import { LoginButton } from './LoginButton'

/** A report opened from the map, by its marker id and where it is. */
export type ReviewFocus = { featureId: string; lat: number; lng: number }

/** Map markers for backend features are `community-<feature id>`. */
const COMMUNITY = 'community-'

export function ReviewQueue({ focus = null }: { focus?: ReviewFocus | null }) {
  const { contributions, userId } = useContributions()
  const requireAuth = useRequireAuth()
  // Not asked for: the queue falls back to campus when there is no fix.
  const { position } = useGeolocation({ auto: false })
  const [lastVote, setLastVote] = useState<Vote | null>(null)

  // Nobody should be asked to judge their own photo. This covers uploads from
  // this session; the queue also matches on the uploader's id from the API.
  const mine = useMemo(
    () => new Set(contributions.map((c) => c.featureId).filter((id): id is string => !!id)),
    [contributions],
  )

  // Opened from a marker: look around that report rather than around you, so
  // the area search that fills in type and location is sure to include it.
  const focusId = focus?.featureId.startsWith(COMMUNITY) ? focus.featureId.slice(COMMUNITY.length) : null
  const centre = focus ? { lat: focus.lat, lng: focus.lng } : position

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
  } = useReviewQueue({ centre, exclude: mine, viewerId: userId })

  // The report picked on the map goes first, until it's voted on or skipped.
  const fromMap = focusId ? queue.find((item) => item.featureId === focusId) : undefined
  const current = fromMap ?? queue[0]
  // Said once the queue has loaded and the report isn't in it.
  const focusNote =
    focus && !loading && !fromMap && !unavailable && !error
      ? focusId
        ? 'That report has nothing waiting for your vote — it may be confirmed already, or be your own.'
        : 'That one was added on this device, so there’s nothing to vote on yet.'
      : null

  async function cast(item: ReviewItem, v: Vote) {
    // Signed out? This sends them to log in and brings them back here after.
    if (!requireAuth() || !userId) return

    // Nothing is claimed until the API agrees, so a refused vote never reads as counted.
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
          {lastVote && (
            <span className="mr-1">{lastVote === 'confirm' ? 'Thanks, confirmed!' : 'Thanks, flagged.'}</span>
          )}
          {reviewed > 0 && `You’ve reviewed ${reviewed}. `}
          {queue.length > 0 && `${queue.length} left to review.`}
        </p>
      </header>

      {focusNote && (
        <p role="status" className="mx-auto mt-4 w-fit rounded-full bg-surface px-4 py-1.5 text-sm text-muted ring-1 ring-border/60">
          {focusNote}
        </p>
      )}

      {loading && !current && (
        <p role="status" className="mt-10 flex items-center justify-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          {focus ? 'Finding that report…' : 'Finding photos to review…'}
        </p>
      )}

      {(unavailable || error) && !loading && (
        <p role="status" className="mt-8 flex items-start gap-2 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--tag-yellow)' }} aria-hidden="true" />
          <span>
            {unavailable
              ? 'The AccessWay API isn’t answering, so there’s nothing to review right now.'
              : `Couldn’t load photos to review: ${error}`}
          </span>
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

          {current.photoUrl ? (
            <img
              src={current.photoUrl}
              alt={current.name ? `Photo of ${current.name}` : 'Photo someone uploaded'}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div
              role="img"
              aria-label="No photo"
              className="grid aspect-[4/3] w-full place-items-center bg-surface text-sm text-muted"
            >
              <span className="flex flex-col items-center gap-1">
                <ImageIcon className="size-8" aria-hidden="true" />
                {bucketUnconfigured ? 'Photo storage isn’t set up here' : 'No photo'}
              </span>
            </div>
          )}

          <div className="p-5 sm:p-6">
            {kind ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                style={{ background: kind.bg }}
              >
                <kind.icon className="size-3.5" style={{ color: kind.color }} aria-hidden="true" />
                {kind.label}
              </span>
            ) : (
              loadingContext && <span className="text-xs text-muted">Loading details…</span>
            )}

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
                // Otherwise the "thanks" line stays up over a card nobody voted on.
                setLastVote(null)
                skip(current)
              }}
              disabled={sending}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-foreground disabled:opacity-60"
            >
              <SkipForward className="size-3.5" aria-hidden="true" /> Not sure, skip
            </button>

            {/* A vote the API refused. Said once, not per photo. */}
            {voteError && (
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
            <p className="max-w-sm text-muted">Nothing waiting nearby. Want to earn some change? Add one of your own.</p>
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
