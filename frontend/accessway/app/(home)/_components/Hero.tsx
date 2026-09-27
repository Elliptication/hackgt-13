import { ArrowRight, Camera, Coins, Flag, MapPinned, Search, Sparkles } from 'lucide-react'

import { Button } from '@/components/Button'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import type { FeatureType } from '@/types/features'
import { REWARD_CENTS, VOTES_TO_APPROVE } from '@/lib/constants'

const HIGHLIGHTS: FeatureType[] = ['ramp', 'elevator', 'accessible_entrance', 'restroom']

const STEPS = [
  {
    icon: Search,
    color: 'var(--tag-blue)',
    bg: 'var(--tag-blue-bg)',
    title: 'Search a place',
    body: 'Look up a building, campus, or street to see what’s nearby.',
  },
  {
    icon: MapPinned,
    color: 'var(--tag-green)',
    bg: 'var(--tag-green-bg)',
    title: 'Spot what works for you',
    body: 'Ramps, elevators, entrances, and restrooms, each in its own color.',
  },
  {
    icon: Flag,
    color: 'var(--tag-orange)',
    bg: 'var(--tag-orange-bg)',
    title: 'Help your neighbors',
    body: 'Flag a broken elevator or add a ramp you found so others know too.',
  },
]

export function Hero() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-10 left-1/2 size-[28rem] -translate-x-[85%] rounded-full bg-[var(--tag-blue-bg)] opacity-100 blur-3xl" />
          <div className="absolute top-24 left-1/2 size-[24rem] -translate-x-[5%] rounded-full bg-[var(--tag-yellow-bg)] opacity-100 blur-3xl" />
          <div className="absolute top-64 left-1/2 size-[20rem] -translate-x-1/2 rounded-full bg-[var(--tag-green-bg)] opacity-90 blur-3xl" />
        </div>

        <div className="mx-auto max-w-3xl px-6 pt-20 pb-20 text-center sm:pt-28">
          <h1 className="mt-6 text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-6xl">
            Get where you’re going, <span className="text-primary">your way.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-pretty text-muted">
            AccessWay maps ramps, elevators, and accessible entrances so every trip starts with a little less
            guesswork.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button href="/map">
              Explore the map <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button href="#how-it-works" variant="secondary">
              How it works
            </Button>
          </div>

          <ul className="mt-12 flex flex-wrap justify-center gap-2" aria-label="Things you can find on the map">
            {HIGHLIGHTS.map((type) => {
              const { plural, icon: Icon, color, bg } = FEATURE_TYPES[type]
              return (
                <li
                  key={type}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                  style={{ background: bg }}
                >
                  <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
                  {plural}
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 text-center text-muted">Three easy steps, no account needed.</p>
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
            <h2 className="text-2xl font-bold tracking-tight">Snap a photo, earn {REWARD_CENTS}¢</h2>
            <p className="mt-1 text-muted">
              Spot a ramp or elevator? Add a photo. Once {VOTES_TO_APPROVE} people confirm it, it goes on the map and you get paid.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button href="/contribute">
              <Coins className="size-4" aria-hidden="true" /> Start earning
            </Button>
            <Button href="/contribute?tab=review" variant="ghost" className="bg-background/60">
              Review photos
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
