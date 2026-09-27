'use client'

import { Camera, Coins, Users } from 'lucide-react'

import { LoginButton } from './LoginButton'
import { useContributions } from '@/hooks/useContributions'
import { REWARD_CENTS, VOTES_TO_APPROVE } from '@/lib/constants'
import { formatCents } from '@/lib/contribute'

const HOW = [
  { icon: Camera, color: 'var(--tag-blue)', bg: 'var(--tag-blue-bg)', text: 'Snap a ramp, elevator, entrance, or restroom' },
  {
    icon: Users,
    color: 'var(--tag-purple)',
    bg: 'var(--tag-purple-bg)',
    text: `${VOTES_TO_APPROVE} people confirm it’s right`,
  },
  {
    icon: Coins,
    color: 'var(--tag-yellow)',
    bg: 'var(--tag-yellow-bg)',
    text: `You earn ${REWARD_CENTS}¢ and it goes on the map`,
  },
]

export function Hero() {
  const { balanceCents, contributions, userId } = useContributions()
  const mine = userId ? contributions.filter((c) => c.submittedBy === userId) : []
  const approved = mine.filter((c) => c.status === 'approved').length
  const pending = mine.filter((c) => c.status === 'pending').length

  return (
    <>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help map what’s accessible</h1>
          <p className="mt-2 max-w-lg text-muted">
            Add photos of ramps, elevators, and entrances to earn {REWARD_CENTS}¢ each, or check photos other people
            added.
          </p>
        </div>

        {userId ? (
          <dl className="flex gap-3" aria-label="Your earnings">
            <div className="rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3">
              <dt className="text-xs text-muted">Earned</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl font-bold">{formatCents(balanceCents)}</dd>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-border/60">
              <dt className="text-xs text-muted">Approved</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl font-bold">{approved}</dd>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-border/60">
              <dt className="text-xs text-muted">In review</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl font-bold">{pending}</dd>
            </div>
          </dl>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--tag-yellow-bg)] px-4 py-3 sm:items-end sm:text-right">
            <p className="text-sm">
              <span className="font-medium">Earn {REWARD_CENTS}¢ per approved photo.</span>
              <br />
              <span className="text-muted">Log in to track what you’ve earned.</span>
            </p>
            <LoginButton className="h-9 px-4 text-sm">Log in to earn</LoginButton>
          </div>
        )}
      </header>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="How rewards work">
        {HOW.map(({ icon: Icon, color, bg, text }, i) => (
          <li key={text} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border/60">
            <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: bg }}>
              <Icon className="size-4" style={{ color }} aria-hidden="true" />
            </span>
            <span className="text-sm">
              <span className="sr-only">Step {i + 1}: </span>
              {text}
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}
