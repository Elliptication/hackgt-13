'use client'

import { ArrowLeft, CircleAlert, CircleCheck, Footprints, LoaderCircle, MapPin } from 'lucide-react'

import { AccessBadge } from '@/components/AccessBadge'
import type { Place } from '@/types/places'
import type { Route } from '@/types/routes'

import { ApiContract } from './ApiContract'

/**
 * What separates this from every other map: the route explains itself.
 *
 * Google will route you without comment. Wheelmap will tell you a place is
 * accessible but never how to reach it. Neither will admit to not knowing.
 * Here, a trip always states what is on it and what nobody has checked — so the
 * decision stays with the person making it.
 */

function readableDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

function readableDistance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`
}

type Props = {
  destination: Place
  route: Route | null
  loading: boolean
  error: string | null
  onBack: () => void
  onRetry: () => void
  /** The backend is not answering — show what it owes us, not an error. */
  offline?: boolean
  /** Null until the person has shared their location. */
  hasOrigin: boolean
}

export function RoutePanel({ destination, route, loading, error, onBack, onRetry, hasOrigin, offline = false }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 border-b border-border px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to search"
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] leading-snug font-bold">{destination.name}</h2>
          {destination.address && <p className="truncate text-xs text-muted">{destination.address}</p>}
          <span className="mt-1.5 inline-block">
            <AccessBadge access={destination.accessibility.wheelchair} size="sm" />
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasOrigin && !loading && (
          <div className="px-4 py-5 text-sm">
            <p className="font-medium">We need to know where you are.</p>
            <p className="mt-1 text-muted">
              Tap the location button on the map, then come back and we will plan the trip.
            </p>
          </div>
        )}

        {loading && (
          <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted" role="status">
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            Planning the trip and checking what is on it…
          </p>
        )}

        {offline && !loading && (
          <div className="px-2 py-3">
            <ApiContract />
          </div>
        )}

        {error && !loading && !offline && (
          <div className="px-4 py-5 text-sm">
            <p className="font-medium">{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 font-medium text-primary underline underline-offset-2">
              Try again
            </button>
          </div>
        )}

        {route && !loading && (
          <>
            <div className="flex items-baseline gap-3 px-4 pt-4 pb-3">
              <span className="font-[family-name:var(--font-display)] text-2xl font-bold">
                {readableDuration(route.duration_s)}
              </span>
              <span className="text-sm text-muted">{readableDistance(route.distance_m)}</span>
            </div>

            {/* The headline judgement, in words rather than a colour */}
            <div
              className="mx-4 flex items-start gap-2.5 rounded-2xl px-3 py-3 text-sm"
              style={{
                background: route.step_free ? 'var(--tag-green-bg)' : 'var(--tag-orange-bg)',
              }}
            >
              {route.step_free ? (
                <CircleCheck className="mt-px size-4 shrink-0" style={{ color: 'var(--tag-green)' }} aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-px size-4 shrink-0" style={{ color: 'var(--tag-orange)' }} aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="font-medium">
                  {route.step_free ? 'No stairs on this route' : 'There are stairs on this route'}
                </p>
                {route.warnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {route.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Saying this out loud is the point. Silence would imply certainty. */}
            <p className="px-4 pt-3 text-xs leading-relaxed text-muted">
              {route.step_free
                ? 'Based on what people have mapped so far. Stretches nobody has checked could still surprise you.'
                : 'We show what has been mapped. There may be more that nobody has recorded yet.'}
            </p>

            <p className="px-4 pt-3 pb-1 text-xs font-medium tracking-wide text-muted uppercase">Directions</p>
            <ol className="px-2 pb-4">
              {route.steps.map((step, i) => (
                <li key={`${step.instruction}-${i}`} className="flex gap-3 rounded-2xl px-2.5 py-2">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-hover">
                    {step.hazard ? (
                      <CircleAlert className="size-3.5" style={{ color: 'var(--tag-orange)' }} aria-hidden="true" />
                    ) : i === route.steps.length - 1 ? (
                      <MapPin className="size-3.5 text-muted" aria-hidden="true" />
                    ) : (
                      <Footprints className="size-3.5 text-muted" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{step.instruction}</span>
                    <span className="block text-xs text-muted">
                      {readableDistance(step.distance_m)}
                      {step.surface && ` · ${step.surface.replace(/_/g, ' ')}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
