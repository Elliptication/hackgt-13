'use client'

import { CheckCircle2, Coins, ImagePlus } from 'lucide-react'

import { LoginButton } from './LoginButton'
import { ContributionPhoto } from './ContributionPhoto'
import { StatusBadge } from './StatusBadge'
import { useContributions } from '@/hooks/useContributions'
import { REWARD_CENTS, VOTES_TO_APPROVE } from '@/lib/constants'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import type { Contribution } from '@/types/contribute'

export function MySubmissions() {
  const { contributions, userId } = useContributions()
  const mine = userId ? contributions.filter((c) => c.submittedBy === userId) : []
  const hasApproved = mine.some((c) => c.status === 'approved')

  return (
    <section aria-labelledby="mine-heading">
      <h2 id="mine-heading" className="flex items-center gap-2 text-xl font-bold">
        Your photos
        {hasApproved && <CheckCircle2 className="size-5 text-[var(--tag-green)]" aria-hidden="true" />}
      </h2>
      {!userId ? <SignedOutState /> : mine.length === 0 ? <EmptyState /> : <SubmissionList contributions={mine} />}
    </section>
  )
}

function SignedOutState() {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center ring-1 ring-border/60">
      <ImagePlus className="size-7 text-subtle" aria-hidden="true" />
      <div>
        <p className="font-medium">Your photos show up here</p>
        <p className="text-sm text-muted">Log in to see what you’ve added and what you’ve earned.</p>
      </div>
      <LoginButton variant="soft" className="h-9 px-4 text-sm">
        Log in to see your photos
      </LoginButton>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-10 text-center ring-1 ring-border/60">
      <ImagePlus className="size-7 text-subtle" aria-hidden="true" />
      <p className="font-medium">No photos yet</p>
      <p className="text-sm text-muted">Your first one could be on the map by tonight.</p>
    </div>
  )
}

function SubmissionList({ contributions: mine }: { contributions: Contribution[] }) {
  const { simulateCommunityVote } = useContributions()

  return (
    <ul className="mt-4 space-y-3">
      {mine.map((c) => (
        <li key={c.id} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border/60">
          <div className="flex gap-3 p-3">
            <ContributionPhoto contribution={c} className="size-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-xs text-muted">{FEATURE_TYPES[c.type].label}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={c.status} />
                {c.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tag-yellow-bg)] px-2.5 py-0.5 text-xs font-medium">
                    <Coins className="size-3.5 text-[var(--tag-yellow)]" aria-hidden="true" />+{REWARD_CENTS}¢
                  </span>
                )}
              </div>
            </div>
          </div>

          {c.status === 'pending' && (
            <div className="border-t border-border/70 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {c.confirms} of {VOTES_TO_APPROVE} confirmations
                </span>
                {c.rejects > 0 && <span>{c.rejects} said not right</span>}
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover"
                role="progressbar"
                aria-label="Confirmations"
                aria-valuemin={0}
                aria-valuemax={VOTES_TO_APPROVE}
                aria-valuenow={c.confirms}
              >
                <div
                  className="h-full rounded-full bg-[var(--tag-green)] transition-[width] duration-500"
                  style={{ width: `${(c.confirms / VOTES_TO_APPROVE) * 100}%` }}
                />
              </div>

              {/* Demo helper: no other real users yet, so let you fake their votes */}
              <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                <span className="text-muted">Demo:</span>
                <button
                  type="button"
                  onClick={() => simulateCommunityVote(c.id, 'confirm')}
                  className="rounded-full px-2 py-0.5 text-muted ring-1 ring-border hover:bg-hover hover:text-foreground"
                >
                  + confirm
                </button>
                <button
                  type="button"
                  onClick={() => simulateCommunityVote(c.id, 'reject')}
                  className="rounded-full px-2 py-0.5 text-muted ring-1 ring-border hover:bg-hover hover:text-foreground"
                >
                  + reject
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
