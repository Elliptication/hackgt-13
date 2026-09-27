'use client'

import { ArrowRight, Crosshair, LoaderCircle, MapPin, MapPinPlus, X } from 'lucide-react'

import { AccessBadge } from '@/components/AccessBadge'
import type { Place } from '@/types/places'

/**
 * Pick two points, then ask for directions.
 *
 * Deliberately not automatic. Choosing a place should show you the place; a
 * trip only gets planned when someone asks for one, because "from here" is
 * often wrong — people plan trips they are not currently standing at the start
 * of.
 */

export type Endpoint = { label: string; place: Place | null; useMyLocation: boolean }

type Props = {
  from: Endpoint
  to: Endpoint
  /** Which field new search picks land in. */
  active: 'from' | 'to'
  onActivate: (which: 'from' | 'to') => void
  onClear: (which: 'from' | 'to') => void
  onUseMyLocation: (which: 'from' | 'to') => void
  onDropPin: (which: 'from' | 'to') => void
  /** Which field is waiting for a pin, if any. */
  pinningFor: 'from' | 'to' | null
  onSwap: () => void
  onPlan: () => void
  canPlan: boolean
  planning: boolean
  hasLocation: boolean
}

function Field({
  which,
  endpoint,
  active,
  onActivate,
  onClear,
  onUseMyLocation,
  onDropPin,
  pinning,
  hasLocation,
}: {
  which: 'from' | 'to'
  endpoint: Endpoint
  active: boolean
  onActivate: () => void
  onClear: () => void
  onUseMyLocation: () => void
  onDropPin: () => void
  pinning: boolean
  hasLocation: boolean
}) {
  const filled = endpoint.useMyLocation || endpoint.place !== null
  const text = endpoint.useMyLocation ? 'My location' : (endpoint.place?.name ?? '')

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl px-3 py-2 transition-shadow ${
        active ? 'bg-background ring-2 ring-ring' : 'bg-surface ring-1 ring-border'
      }`}
    >
      {which === 'from' ? (
        <Crosshair className="size-4 shrink-0 text-subtle" aria-hidden="true" />
      ) : (
        <MapPin className="size-4 shrink-0 text-subtle" aria-hidden="true" />
      )}

      <button
        type="button"
        onClick={onActivate}
        className="min-w-0 flex-1 text-left"
        aria-label={`${which === 'from' ? 'Starting point' : 'Destination'}${filled ? `: ${text}` : ', not set'}`}
      >
        <span className="block text-[11px] tracking-wide text-muted uppercase">
          {which === 'from' ? 'From' : 'To'}
        </span>
        <span className={`block truncate text-sm ${filled ? 'font-medium' : 'text-muted'}`}>
          {filled ? text : pinning ? 'Now click anywhere on the map' : 'Search, or drop a pin'}
        </span>
      </button>

      {filled ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${which === 'from' ? 'starting point' : 'destination'}`}
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        <span className="flex shrink-0 items-center gap-0.5">
          {hasLocation && (
            <button
              type="button"
              onClick={onUseMyLocation}
              title="Use my location"
              aria-label={`Use my location as the ${which === 'from' ? 'starting point' : 'destination'}`}
              className="grid size-8 place-items-center rounded-full text-primary hover:bg-hover"
            >
              <Crosshair className="size-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onDropPin}
            title="Drop a pin on the map"
            aria-label={`Drop a pin to set the ${which === 'from' ? 'starting point' : 'destination'}`}
            aria-pressed={pinning}
            className={`grid size-8 place-items-center rounded-full transition-colors ${pinning ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-hover hover:text-foreground'}`}
          >
            <MapPinPlus className="size-4" aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  )
}

export function TripPlanner({
  from,
  to,
  active,
  onActivate,
  onClear,
  onUseMyLocation,
  onDropPin,
  pinningFor,
  onSwap,
  onPlan,
  canPlan,
  planning,
  hasLocation,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 pt-1 pb-4">
      <Field
        which="from"
        endpoint={from}
        active={active === 'from'}
        onActivate={() => onActivate('from')}
        onClear={() => onClear('from')}
        onUseMyLocation={() => onUseMyLocation('from')}
        onDropPin={() => onDropPin('from')}
        pinning={pinningFor === 'from'}
        hasLocation={hasLocation}
      />

      <Field
        which="to"
        endpoint={to}
        active={active === 'to'}
        onActivate={() => onActivate('to')}
        onClear={() => onClear('to')}
        onUseMyLocation={() => onUseMyLocation('to')}
        onDropPin={() => onDropPin('to')}
        pinning={pinningFor === 'to'}
        hasLocation={hasLocation}
      />

      {to.place && (
        <div className="flex items-center justify-between pt-0.5">
          <AccessBadge access={to.place.accessibility.wheelchair} size="sm" />
          <button type="button" onClick={onSwap} className="rounded-full px-2 py-1 text-xs text-muted hover:bg-hover">
            Swap
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onPlan}
        disabled={!canPlan || planning}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45 motion-safe:active:scale-[0.99]"
      >
        {planning ? (
          <>
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            Finding a way
          </>
        ) : (
          <>
            Show the route
            <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  )
}
