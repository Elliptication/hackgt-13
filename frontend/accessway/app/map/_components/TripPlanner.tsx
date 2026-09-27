'use client'

import { ArrowRight, Crosshair, LoaderCircle, MapPin, MapPinPlus, X } from 'lucide-react'
import { useState } from 'react'

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
  /** What's typed in the active field. */
  query: string
  onQuery: (value: string) => void
  /** id of the results list the fields search into. */
  resultsId: string
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
  locationStatus: 'idle' | 'locating' | 'error'
  locationMessage: string | null
}

function Field({
  which,
  endpoint,
  active,
  query,
  onQuery,
  resultsId,
  onActivate,
  onClear,
  onUseMyLocation,
  onDropPin,
  pinning,
  hasLocation,
  locationStatus,
  locationMessage,
}: {
  which: 'from' | 'to'
  endpoint: Endpoint
  active: boolean
  query: string
  onQuery: (value: string) => void
  resultsId: string
  onActivate: () => void
  onClear: () => void
  onUseMyLocation: () => void
  onDropPin: () => void
  pinning: boolean
  hasLocation: boolean
  locationStatus: 'idle' | 'locating' | 'error'
  locationMessage: string | null
}) {
  const [focused, setFocused] = useState(false)

  const mine = endpoint.useMyLocation
  // "My location" was chosen but the browser couldn't (or wouldn't) say where.
  const failed = mine && !hasLocation && locationStatus === 'error'
  const finding = mine && !hasLocation && !failed
  const filled = (mine && !failed) || endpoint.place !== null
  const text = mine ? (finding ? 'Finding your location…' : 'Your location') : (endpoint.place?.name ?? '')

  // Typing in the box searches. While you're in it (or have typed something
  // that hasn't been picked yet) it shows your search; otherwise what's set.
  const editing = active && (focused || query !== '')
  const value = editing ? query : filled ? text : ''
  const name = which === 'from' ? 'Starting point' : 'Destination'

  const placeholder = failed
    ? (locationMessage ?? "Couldn't find your location")
    : pinning
      ? 'Now click anywhere on the map'
      : editing && filled
        ? text
        : which === 'from'
          ? 'Your location, a place, or a pin'
          : 'Search for a place'

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

      <label className="min-w-0 flex-1 cursor-text">
        <span className="block text-[11px] tracking-wide text-muted uppercase">
          {which === 'from' ? 'From' : 'To'}
        </span>
        <span className="flex items-center gap-1.5" title={failed ? (locationMessage ?? undefined) : undefined}>
          {!editing && finding && (
            <LoaderCircle className="size-3.5 shrink-0 text-muted motion-safe:animate-spin" aria-hidden="true" />
          )}
          {!editing && mine && !finding && !failed && (
            <span className="size-2 shrink-0 rounded-full bg-[#0b6bcb]" aria-hidden="true" />
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => {
              setFocused(true)
              onActivate()
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onQuery('')
                e.currentTarget.blur()
              }
            }}
            placeholder={placeholder}
            aria-label={`${name}${filled ? `: ${text}` : ''}. Type to search.`}
            aria-controls={resultsId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            // The whole field lights up when active, so the global focus outline
            // would just draw a second box inside it.
            style={{ outline: 'none' }}
            className={`w-full min-w-0 truncate bg-transparent text-sm outline-none placeholder:text-muted ${
              filled && !editing && !finding ? 'font-medium' : ''
            } ${finding && !editing ? 'text-muted' : ''}`}
          />
        </span>
      </label>

      {editing && query ? (
        <button
          type="button"
          // Keep focus in the box, so clearing lets you type again straight away.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onQuery('')}
          aria-label="Clear search"
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : filled ? (
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
          <button
            type="button"
            onClick={onUseMyLocation}
            title={failed ? 'Try finding my location again' : 'Use my location'}
            aria-label={`Use my location as the ${which === 'from' ? 'starting point' : 'destination'}`}
            className="grid size-8 place-items-center rounded-full text-primary hover:bg-hover"
          >
            <Crosshair className="size-4" aria-hidden="true" />
          </button>
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
  query,
  onQuery,
  resultsId,
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
  locationStatus,
  locationMessage,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 pt-1 pb-4">
      <h1 className="sr-only">Plan a trip</h1>
      <Field
        which="from"
        endpoint={from}
        active={active === 'from'}
        query={active === 'from' ? query : ''}
        onQuery={onQuery}
        resultsId={resultsId}
        onActivate={() => onActivate('from')}
        onClear={() => onClear('from')}
        onUseMyLocation={() => onUseMyLocation('from')}
        onDropPin={() => onDropPin('from')}
        pinning={pinningFor === 'from'}
        hasLocation={hasLocation}
        locationStatus={locationStatus}
        locationMessage={locationMessage}
      />

      <Field
        which="to"
        endpoint={to}
        active={active === 'to'}
        query={active === 'to' ? query : ''}
        onQuery={onQuery}
        resultsId={resultsId}
        onActivate={() => onActivate('to')}
        onClear={() => onClear('to')}
        onUseMyLocation={() => onUseMyLocation('to')}
        onDropPin={() => onDropPin('to')}
        pinning={pinningFor === 'to'}
        hasLocation={hasLocation}
        locationStatus={locationStatus}
        locationMessage={locationMessage}
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
