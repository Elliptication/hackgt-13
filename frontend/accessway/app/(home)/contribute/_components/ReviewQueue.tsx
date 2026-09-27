'use client'

import { Check, ImageOff, LoaderCircle, PartyPopper, SkipForward, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { LoginButton } from './LoginButton'
import { LocationPicker } from './LocationPicker'
import { useContributions } from '@/hooks/useContributions'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useReviewQueue, type ReviewItem } from '@/hooks/useReviewQueue'
import type { Vote } from '@/types/contribute'
import { FEATURE_TYPES } from '@/data/FeatureTypes'

/**
 * Judge the photos people have uploaded. Votes go to `POST /vote/`.
 *
 * The queue is built from `GET /contributions/` — a review is a judgement about
 * a photo, and that is the only endpoint that returns one. `/features` fills in
 * the type, name and location where it can; where it cannot, the card says so
 * and the vote still works, because a vote only needs the contribution id.
 */
export function ReviewQueue() {
  const { userId, contributions } = useContributions()
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

  const {
    queue,
    reviewed,
    loading,
    loadingContext,
    error,
    unavailable,
    bucketUnconfigured,
    voteError,
    vote,
    skip,
    refresh,
  } = useReviewQueue({ centre: position, exclude: mine, viewerId: userId })

  const current = queue[0]

  async function cast(item: ReviewItem, v: Vote) {
    // Signed out? This sends them to log in and brings them back here after.
    if (!requireAuth() || !userId) return
    setLastVote(v)
    await vote(item, v, userId)
  }

  // Only known once `/features` answers. Until then the card asks the neutral
  // question rather than guessing at a type it does not have.
  const kind = current?.type ? FEATURE_TYPES[current.type] : null

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

      {loading && !current && (
        <p role="status" className="mt-10 flex items-center justify-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          Loading what needs checking…
        </p>
      )}

      {unavailable && !loading && (
        <p role="status" className="mt-8 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          The AccessWay API isn’t answering, so there’s nothing to review right now. It’ll fill in once the
          service is back.
        </p>
      )}

      {error && !loading && (
        <p role="status" className="mt-8 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {bucketUnconfigured && !loading && queue.length > 0 && (
        <p role="status" className="mt-8 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 text-sm">
          <code className="rounded bg-background/60 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> is unset,
          so the uploaded photos can’t be read back — there’s nothing to judge until it’s set.
        </p>
      )}

      {current ? (
        <article
          key={current.contributionId}
          className="mt-8 overflow-hidden rounded-3xl bg-background shadow-[0_8px_30px_-12px_rgb(15_15_15/0.18)] ring-1 ring-border"
          aria-labelledby="review-name"
        >
          {current.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- a Supabase
               storage URL, not an asset the optimizer can reach */
            <img
              src={current.photoUrl}
              // The description would be the real alt text, but the API drops it
              // at upload (REVIEWS-API.md §2), so name the subject at least.
              alt={current.description || `Photo awaiting review${kind ? `: a ${kind.label.toLowerCase()}` : ''}`}
              className="aspect-[4/3] w-full bg-surface object-cover"
            />
          ) : (
            /* Honest about the gap rather than dressing a placeholder up as
               somebody's photo — judging a photo is the whole point here. */
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-surface text-center">
              <ImageOff className="size-8 text-subtle" aria-hidden="true" />
              <p className="px-6 text-sm font-medium">No photo to show</p>
              <p className="max-w-xs px-6 text-xs text-muted">
                The stored photo couldn’t be read back. Judge it on what’s below, or skip.
              </p>
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hover px-3 py-1 text-sm text-muted">
                {loadingContext ? (
                  <>
                    <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> Loading details…
                  </>
                ) : (
                  'Type not recorded'
                )}
              </span>
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
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--tag-red-bg)] font-medium transition hover:brightness-[0.97] motion-safe:active:scale-[0.98]"
                >
                  <X className="size-5 text-[var(--tag-red)]" aria-hidden="true" /> Not right
                </button>
                <button
                  type="button"
                  onClick={() => cast(current, 'confirm')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--tag-green-bg)] font-medium transition hover:brightness-[0.97] motion-safe:active:scale-[0.98]"
                >
                  <Check className="size-5 text-[var(--tag-green)]" aria-hidden="true" /> Looks right
                </button>
              </div>
            ) : (
              <LoginButton className="mt-3 w-full">Log in to vote</LoginButton>
            )}
            <button
              type="button"
              onClick={() => skip(current)}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-foreground"
            >
              <SkipForward className="size-3.5" aria-hidden="true" /> Not sure, skip
            </button>

            {/* A vote the API refused. The card comes back, so this is the
                explanation for why it did. */}
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
