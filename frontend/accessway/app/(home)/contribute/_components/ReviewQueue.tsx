'use client'

import { Check, PartyPopper, SkipForward, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/Button'
import { LoginButton } from './LoginButton'
import { ContributionPhoto } from './ContributionPhoto'
import { LocationPicker } from './LocationPicker'
import { useContributions } from '@/hooks/useContributions'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { VOTES_TO_APPROVE } from '@/lib/constants'
import type { Vote } from '@/types/contribute'
import { FEATURE_TYPES } from '@/data/FeatureTypes'

export function ReviewQueue() {
  const { contributions, userId, myVotes, vote } = useContributions()
  const requireAuth = useRequireAuth()
  const [skipped, setSkipped] = useState<string[]>([])
  const [lastVote, setLastVote] = useState<Vote | null>(null)

  // Other people's pending photos you haven't voted on or skipped
  const queue = contributions.filter(
    (c) => c.status === 'pending' && c.submittedBy !== userId && !myVotes[c.id] && !skipped.includes(c.id),
  )
  const current = queue[0]
  const reviewedCount = Object.keys(myVotes).length

  function cast(v: Vote) {
    if (!current) return
    // Signed out? This sends you to sign up and brings you back here after
    if (!requireAuth()) return
    vote(current.id, v)
    setLastVote(v)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Is this right?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Help check photos from the community. Each one needs {VOTES_TO_APPROVE} thumbs-up before it goes on the map.
        </p>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {lastVote && (
            <span className="mr-1">{lastVote === 'confirm' ? 'Thanks, confirmed!' : 'Thanks, flagged.'}</span>
          )}
          {reviewedCount > 0 && `You’ve reviewed ${reviewedCount}. `}
          {queue.length > 0 && `${queue.length} left to review.`}
        </p>
      </header>

      {current ? (
        <article
          key={current.id}
          className="mt-8 overflow-hidden rounded-3xl bg-background shadow-[0_8px_30px_-12px_rgb(15_15_15/0.18)] ring-1 ring-border"
          aria-labelledby="review-name"
        >
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
            <p className="mt-1 text-[15px] leading-relaxed text-muted">{current.description}</p>

            <div className="mt-4 h-36 overflow-hidden rounded-2xl ring-1 ring-border" aria-label="Location on map" role="img">
              <LocationPicker
                value={{ lat: current.lat, lng: current.lng }}
                center={{ lat: current.lat, lng: current.lng }}
                readOnly
              />
            </div>

            <p className="mt-5 text-center font-medium">
              Does this photo really show {withArticle(FEATURE_TYPES[current.type].label.toLowerCase())}?
            </p>
            {userId ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cast('reject')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--tag-red-bg)] font-medium transition hover:brightness-[0.97] motion-safe:active:scale-[0.98]"
                >
                  <X className="size-5 text-[var(--tag-red)]" aria-hidden="true" /> Not right
                </button>
                <button
                  type="button"
                  onClick={() => cast('confirm')}
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
              onClick={() => setSkipped((s) => [...s, current.id])}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-foreground"
            >
              <SkipForward className="size-3.5" aria-hidden="true" /> Not sure, skip
            </button>

            <p className="mt-4 text-center text-xs text-muted">
              {current.confirms} of {VOTES_TO_APPROVE} confirmations so far
            </p>
          </div>
        </article>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-14 text-center ring-1 ring-border/60">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--tag-yellow-bg)]">
            <PartyPopper className="size-7 text-[var(--tag-yellow)]" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-bold">All caught up!</h2>
          <p className="max-w-sm text-muted">
            No photos waiting right now. Want to earn some change? Add one of your own.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button href="/contribute?tab=add" size="md">
              Add a photo
            </Button>
            {skipped.length > 0 && (
              <button
                type="button"
                onClick={() => setSkipped([])}
                className="inline-flex h-9 items-center rounded-full bg-primary-soft px-4 text-sm font-medium hover:brightness-[0.97]"
              >
                See skipped ({skipped.length})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** "a ramp", "an elevator" */
function withArticle(noun: string) {
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`
}
