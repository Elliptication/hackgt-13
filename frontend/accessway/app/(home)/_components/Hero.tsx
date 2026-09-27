import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/Button'
import { REWARD_CENTS, VOTES_TO_APPROVE } from '@/lib/constants'

import { HomeMap } from './HomeMap'

/**
 * The home page.
 *
 * It leads with the map itself rather than a description of one: real tiles,
 * real pins, real counts. Everything below is short and specific, because the
 * people reading it want to know one thing — can I get in — and the honest
 * answer today is "sometimes, and you can help".
 *
 * The previous design is in design-backup/home-Hero.tsx.txt.
 */

const STEPS = [
  {
    title: 'Look it up before you go',
    body: 'Search a building or an address and see its step-free entrances, elevators and accessible restrooms.',
  },
  {
    title: 'Take a route that works',
    body: 'Turn on walkable paths to see sidewalks, curb ramps, and where the stairs are.',
  },
  {
    title: 'Add what’s missing',
    body: `Photograph a ramp or an elevator. Once ${VOTES_TO_APPROVE} people confirm it, it’s on the map and you get ${REWARD_CENTS}¢.`,
  },
]

export function Hero() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
        <div>
          <h1 className="text-4xl leading-[1.08] font-bold text-balance sm:text-5xl lg:text-[3.4rem]">
            Know the way in before you get there.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-pretty text-muted">
            AccessWay maps ramps, elevators, accessible entrances and restrooms. Each one is added and checked by
            people who use them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/map">
              Open the map <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button href="/contribute" variant="ghost" className="text-foreground ring-1 ring-border">
              Add a place
            </Button>
          </div>
        </div>

        <HomeMap />
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">How it works</h2>
          <ol className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {STEPS.map(({ title, body }, i) => (
              <li key={title}>
                <span className="text-sm font-semibold text-primary tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-1 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold sm:text-3xl">Most of this map doesn’t exist yet.</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Fewer than 1 in 50 buildings around here say whether you can get in with a wheelchair. Every
              photo you add fills one of those gaps, and pays {REWARD_CENTS}¢ once it’s confirmed.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/contribute">Add a photo</Button>
            <Button href="/contribute?tab=review" variant="ghost" className="bg-background text-foreground ring-1 ring-border">
              Check someone’s photo
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
