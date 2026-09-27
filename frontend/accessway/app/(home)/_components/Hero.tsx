import { ArrowRight, Camera, Coins, MapPinned, Search, Users } from 'lucide-react'

import { Button } from '@/components/Button'
import { REWARD_CENTS, VOTES_TO_APPROVE } from '@/lib/constants'

/**
 * The page leads with who it is for, and what they get.
 *
 * Two commitments shape everything below the headline:
 *   - we say what we do not know, rather than implying everywhere is fine
 *   - almost nothing is mapped yet, so the community is the product and not a
 *     side feature — which is why "Add a place" sits in the hero rather than in
 *     a footer
 */

const WHAT_WE_MAP = [
  { label: 'Step-free entrances', color: 'var(--tag-purple)', bg: 'var(--tag-purple-bg)' },
  { label: 'Elevators', color: 'var(--tag-blue)', bg: 'var(--tag-blue-bg)' },
  { label: 'Ramps', color: 'var(--tag-green)', bg: 'var(--tag-green-bg)' },
  { label: 'Accessible restrooms', color: 'var(--tag-orange)', bg: 'var(--tag-orange-bg)' },
  { label: 'Stairs and curbs in the way', color: 'var(--tag-red)', bg: 'var(--tag-red-bg)' },
]

const STEPS = [
  {
    icon: Search,
    color: 'var(--tag-blue)',
    bg: 'var(--tag-blue-bg)',
    title: 'Say where you want to go',
    body: 'Search any place. We show whether you can get in, or admit that nobody has checked.',
  },
  {
    icon: MapPinned,
    color: 'var(--tag-green)',
    bg: 'var(--tag-green-bg)',
    title: 'Get a route without stairs',
    body: 'Directions along footways, avoiding steps and high curbs — and we name what is on the way.',
  },
  {
    icon: Users,
    color: 'var(--tag-orange)',
    bg: 'var(--tag-orange-bg)',
    title: 'Fill in a blank',
    body: `Add a photo of an entrance. ${VOTES_TO_APPROVE} people confirm it, and it is on the map for everyone.`,
  },
]

export function Hero() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        {/* Soft pastel glow behind the headline */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-10 left-1/2 size-[28rem] -translate-x-[85%] rounded-full bg-[var(--tag-blue-bg)] opacity-100 blur-3xl" />
          <div className="absolute top-24 left-1/2 size-[24rem] -translate-x-[5%] rounded-full bg-[var(--tag-yellow-bg)] opacity-100 blur-3xl" />
          <div className="absolute top-64 left-1/2 size-[20rem] -translate-x-1/2 rounded-full bg-[var(--tag-green-bg)] opacity-90 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl px-6 pt-20 pb-20 text-center sm:pt-28">
          <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-6xl">
            Helping wheelchair users{' '}
            <span className="text-primary">get where they need to go.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-pretty text-muted">
            Find accessible places, entrances, ramps, elevators and routes — powered by a community sharing
            real accessibility information.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button href="/map">
              Open the map <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button href="/contribute" variant="secondary">
              <Camera className="size-4" aria-hidden="true" />
              Add a place
            </Button>
          </div>

          <ul className="mt-12 flex flex-wrap justify-center gap-2" aria-label="What the map shows">
            {WHAT_WE_MAP.map(({ label, color, bg }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                style={{ background: bg, color }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 text-center text-muted">No account needed to look. One photo to help.</p>
          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, color, bg, title, body }) => (
              <li
                key={title}
                className="rounded-3xl bg-surface p-6 ring-1 ring-border/60 transition-transform motion-safe:hover:-translate-y-0.5"
              >
                <span className="grid size-11 place-items-center rounded-2xl" style={{ background: bg }}>
                  <Icon className="size-5" style={{ color }} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl bg-[var(--tag-yellow-bg)] px-6 py-10 text-center sm:flex-row sm:px-10 sm:text-left">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-background">
            <Camera className="size-7 text-[var(--tag-yellow)]" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">The map is only as good as we make it</h2>
            <p className="mt-1 text-muted">
              Photograph one entrance on your way past. {VOTES_TO_APPROVE} neighbours confirm it, it goes live
              for everyone, and you earn {REWARD_CENTS}¢ for the trouble.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button href="/contribute">
              <Coins className="size-4" aria-hidden="true" /> Add a place
            </Button>
            <Button href="/contribute?tab=review" variant="ghost" className="bg-background/60">
              Check someone&rsquo;s photo
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
