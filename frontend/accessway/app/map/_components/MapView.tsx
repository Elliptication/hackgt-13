'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Accessibility, Crosshair, Footprints, LoaderCircle, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { useCallback, useId, useMemo, useState } from 'react'

import { AccessBadge } from '@/components/AccessBadge'

import { ApiContract } from './ApiContract'
import { Button } from '@/components/Button'
import { UserMenu } from '@/components/Header/UserMenu'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import { useAuth } from '@/hooks/useAuth'
import { useContributions } from '@/hooks/useContributions'
import { useFeatures } from '@/hooks/useFeatures'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useWalkable } from '@/hooks/useWalkable'
import { usePlaceSearch } from '@/hooks/usePlaceSearch'
import { useRoute } from '@/hooks/useRoute'
import { APP_NAME } from '@/lib/constants'
import { FEATURE_ICONS } from '@/lib/featureIcons'
import { toFeature } from '@/lib/contribute'
import type { FeatureType } from '@/types/features'
import type { LatLng, Place } from '@/types/places'

import { RoutePanel } from './RoutePanel'
import { TripPlanner, type Endpoint } from './TripPlanner'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" aria-hidden="true" />,
})

const EMPTY: Endpoint = { label: '', place: null, useMyLocation: false }
const MY_LOCATION: Endpoint = { label: 'Your location', place: null, useMyLocation: true }

type MapViewProps = {
  notice?: string | null
}

export function MapView({ notice = null }: MapViewProps) {
  const [query, setQuery] = useState('')
  const [bbox, setBbox] = useState<string | null>(null)
  /** Feature types to show. Empty means all of them. */
  const [typeFilter, setTypeFilter] = useState<Set<FeatureType>>(() => new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const filterId = useId()
  const [zoom, setZoom] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'auto' | 'open' | 'closed'>('auto')
  const [showWalkable, setShowWalkable] = useState(false)
  const [pinningFor, setPinningFor] = useState<'from' | 'to' | null>(null)

  const [from, setFrom] = useState<Endpoint>(MY_LOCATION)
  const [to, setTo] = useState<Endpoint>(EMPTY)
  const [active, setActive] = useState<'from' | 'to'>('to')

  const { user } = useAuth()
  const panelId = useId()
  const resultsId = useId()

  const { position: myLocation, status: locationStatus, message: locationMessage, locate } = useGeolocation()
  const origin: LatLng | null = myLocation

  const { features: surveyed, loading: loadingArea, error: areaError, tooFarOut, noBackend } = useFeatures( bbox, zoom)
  const { contributions } = useContributions()

  const features = useMemo(
    () => [...surveyed, ...contributions.filter((c) => c.status === 'approved').map(toFeature)],
    [surveyed, contributions],
  )
  const { paths, kerbs, loading: loadingWalkable } = useWalkable(showWalkable, bbox, zoom)
  const { results, loading: searching, error: searchError, offline: searchOffline } = usePlaceSearch(query, bbox, origin)
  const { route, destination, loading: routing, error: routeError, offline: routeOffline, findRoute, clear } = useRoute()

  const handleBounds = useCallback((next: string, level: number) => {
    setBbox(next)
    setZoom(level)
  }, [])

  function activate(which: 'from' | 'to') {
    if (which !== active) setQuery('')
    setActive(which)
  }

  function chooseMyLocation(which: 'from' | 'to') {
    if (which === 'from') {
      setFrom(MY_LOCATION)
      setActive('to')
    } else {
      setTo(MY_LOCATION)
    }
    setQuery('')
    if (!myLocation && locationStatus !== 'locating') locate()
  }

  // The type filter applies to the map and the sidebar alike.
  const shown = useMemo(
    () => (typeFilter.size === 0 ? features : features.filter((f) => typeFilter.has(f.type))),
    [features, typeFilter],
  )

  // The sidebar lists what's in view, not the first 60 things ever loaded —
  // otherwise after flying to another city it kept listing the old one.
  const nearby = useMemo(() => {
    if (!bbox) return shown.slice(0, 60)
    const [west, south, east, north] = bbox.split(',').map(Number)
    return shown.filter((f) => f.lat >= south && f.lat <= north && f.lng >= west && f.lng <= east).slice(0, 60)
  }, [shown, bbox])

  function toggleType(type: FeatureType) {
    setTypeFilter((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function dropPin(at: LatLng) {
    const which = pinningFor
    if (!which) return
    const place: Place = {
      id: `pin-${at.lat.toFixed(5)}-${at.lng.toFixed(5)}`,
      name: 'Dropped pin',
      category: 'other',
      lat: at.lat,
      lng: at.lng,
      address: `${at.lat.toFixed(4)}, ${at.lng.toFixed(4)}`,
      accessibility: {
        wheelchair: 'unknown',
        score: null,
        step_free_entrance: null,
        accessible_restroom: null,
        elevator: null,
        automatic_door: null,
        notes: null,
      },
      features: [],
      updated_at: new Date().toISOString(),
    }
    if (which === 'from') setFrom({ label: place.name, place, useMyLocation: false })
    else setTo({ label: place.name, place, useMyLocation: false })
    setPinningFor(null)
  }

  const backendMissing = noBackend || searchOffline || routeOffline

  const droppedMarkers = useMemo(() => {
    const out: { id: string; at: LatLng; label: string }[] = []
    for (const [which, e] of [['from', from], ['to', to]] as const) {
      if (e.useMyLocation || !e.place) continue
      out.push({
        id: which,
        at: { lat: e.place.lat, lng: e.place.lng },
        label: which === 'from' ? 'Start' : 'Destination',
      })
    }
    return out
  }, [from, to])

  function pick(place: Place) {
    const endpoint: Endpoint = { label: place.name, place, useMyLocation: false }
    if (active === 'from') {
      setFrom(endpoint)
      setActive('to')
    } else {
      setTo(endpoint)
    }
    setQuery('')
  }

  function coordsOf(endpoint: Endpoint): LatLng | null {
    if (endpoint.useMyLocation) return origin
    return endpoint.place ? { lat: endpoint.place.lat, lng: endpoint.place.lng } : null
  }

  const fromAt = coordsOf(from)
  const toAt = coordsOf(to)
  const canPlan = fromAt !== null && toAt !== null

  function plan() {
    if (!fromAt || !toAt || !to.place) return
    findRoute(fromAt, to.place)
    if (!isDesktop()) setPanel('closed')
  }

  function togglePanel() {
    setPanel(panelVisible() ? 'closed' : 'open')
  }

  function panelVisible() {
    return panel === 'open' || (panel === 'auto' && isDesktop())
  }

  const panelPosition = {
    auto: '-translate-x-full max-md:invisible md:translate-x-0 md:shadow-[4px_0_24px_-8px_rgb(15_15_15/0.25)]',
    open: 'translate-x-0 shadow-[4px_0_24px_-8px_rgb(15_15_15/0.25)]',
    closed: '-translate-x-full invisible',
  }[panel]
  const openButton = { auto: 'flex md:hidden', open: 'hidden', closed: 'flex' }[panel]

  return (
    <div className="relative h-full w-full overflow-hidden">
      <button
        type="button"
        onClick={togglePanel}
        aria-controls={panelId}
        aria-expanded={false}
        className={`absolute top-3 left-3 z-10 h-11 max-w-[70%] items-center gap-2 rounded-full bg-background pr-4 pl-3 text-[15px] font-medium shadow-[0_2px_12px_-2px_rgb(15_15_15/0.25)] hover:bg-hover ${openButton}`}
      >
        <PanelLeftOpen className="size-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{destination ? destination.name : 'Plan a trip'}</span>
      </button>

      <aside
        id={panelId}
        aria-label="Sidebar"
        className={`absolute inset-y-0 left-0 z-20 flex w-full flex-col bg-background transition-[translate,visibility] duration-200 ease-out motion-reduce:transition-none md:w-[23rem] ${panelPosition}`}
      >
        <div className="flex items-center justify-between px-3 pt-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full px-2 py-1 font-[family-name:var(--font-display)] text-[17px] font-bold hover:bg-hover"
          >
            <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-primary">
              <Accessibility className="size-4" aria-hidden="true" />
            </span>
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Button href="/login?next=%2Fmap" variant="ghost" size="md">
                Log in
              </Button>
            )}
            <button
              type="button"
              onClick={togglePanel}
              aria-controls={panelId}
              aria-expanded={true}
              aria-label="Hide sidebar"
              className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover hover:text-foreground"
            >
              <PanelLeftClose className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {route || routing || routeError ? (
          <RoutePanel
            destination={destination ?? to.place!}
            route={route}
            loading={routing}
            error={routeError}
            offline={routeOffline}
            hasOrigin={fromAt !== null}
            onBack={() => {
              clear()
              setActive('to')
            }}
            onRetry={plan}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {notice && (
              <p
                role="status"
                className="mx-4 mt-3 flex items-start gap-2 rounded-2xl bg-[var(--tag-yellow-bg)] px-3 py-2.5 text-xs leading-relaxed"
              >
                <TriangleAlert className="mt-px size-4 shrink-0" style={{ color: 'var(--tag-yellow)' }} aria-hidden="true" />
                <span>{notice}</span>
              </p>
            )}

            <TripPlanner
              from={from}
              to={to}
              active={active}
              query={query}
              onQuery={setQuery}
              resultsId={resultsId}
              onActivate={activate}
              onClear={(which) => (which === 'from' ? setFrom(EMPTY) : setTo(EMPTY))}
              onDropPin={(which) => setPinningFor((current) => (current === which ? null : which))}
              pinningFor={pinningFor}
              onUseMyLocation={chooseMyLocation}
              onSwap={() => {
                setFrom(to)
                setTo(from)
              }}
              onPlan={plan}
              canPlan={canPlan && to.place !== null}
              planning={routing}
              hasLocation={origin !== null}
              locationStatus={locationStatus}
              locationMessage={locationMessage}
            />

            <div id={resultsId} className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-4">
              {searching && (
                <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted" role="status">
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  Searching…
                </p>
              )}

              {searchError && !searching && !backendMissing && (
                <p className="px-3 py-4 text-sm">{searchError}</p>
              )}

              {backendMissing && !searching && query.trim().length >= 2 && <ApiContract />}

              {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted">
                  Nothing by that name nearby. Try a different spelling, or move the map closer.
                </p>
              )}

              {results.length > 0 && (
                <ul>
                  {results.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => pick(place)}
                        className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{place.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {place.address ?? place.category.replace(/_/g, ' ')}
                          </span>
                        </span>
                        <AccessBadge access={place.accessibility.wheelchair} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {query.trim().length < 2 && (
                <>
                  {/* The quickest way to say "I'm starting from here" */}
                  {active === 'from' && !from.useMyLocation && (
                    <button
                      type="button"
                      onClick={() => chooseMyLocation('from')}
                      className="mx-1 mb-2 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-hover"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                        {locationStatus === 'locating' ? (
                          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                        ) : (
                          <Crosshair className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">Your location</span>
                        <span className="block truncate text-xs text-muted">
                          {locationStatus === 'error' && !myLocation
                            ? (locationMessage ?? "Couldn't find you. Tap to try again.")
                            : 'Start the trip from where you are'}
                        </span>
                      </span>
                    </button>
                  )}

                  <label className="mx-1 mb-1 flex cursor-pointer items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 text-sm ring-1 ring-border select-none has-focus-visible:ring-2 has-focus-visible:ring-ring">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={showWalkable}
                      onChange={() => setShowWalkable((on) => !on)}
                    />
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${showWalkable ? 'bg-primary text-primary-foreground' : 'bg-hover text-muted'}`}>
                      <Footprints className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Show walkable routes</span>
                      <span className="block text-xs text-muted">
                        {loadingWalkable ? 'Loading the sidewalk network…' : 'Which paths you can actually take'}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${showWalkable ? 'bg-primary' : 'bg-border'}`}
                    >
                      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${showWalkable ? 'left-[1.125rem]' : 'left-0.5'}`} />
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-2 pt-1 pr-1 pl-3">
                    <p className="text-xs font-medium tracking-wide text-muted uppercase">In this area</p>
                    <button
                      type="button"
                      onClick={() => setFilterOpen((open) => !open)}
                      aria-expanded={filterOpen}
                      aria-controls={filterId}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${
                        typeFilter.size > 0 ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-hover hover:text-foreground'
                      }`}
                    >
                      <SlidersHorizontal className="size-4" aria-hidden="true" />
                      Filter
                      {typeFilter.size > 0 && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                          {typeFilter.size}
                          <span className="sr-only"> selected</span>
                        </span>
                      )}
                    </button>
                  </div>

                  {filterOpen && (
                    <div id={filterId} role="group" aria-label="Show only" className="flex flex-wrap gap-1.5 px-2 pt-1.5 pb-1">
                      {(Object.entries(FEATURE_TYPES) as [FeatureType, (typeof FEATURE_TYPES)[FeatureType]][]).map(
                        ([type, meta]) => {
                          const Icon = FEATURE_ICONS[type]
                          const on = typeFilter.has(type)
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => toggleType(type)}
                              aria-pressed={on}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${
                                on ? 'font-medium ring-2 ring-current' : 'bg-surface ring-1 ring-border hover:bg-hover'
                              }`}
                              style={on ? { background: meta.bg, color: meta.color } : undefined}
                            >
                              <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden="true" />
                              <span className={on ? 'text-foreground' : ''}>{meta.plural}</span>
                            </button>
                          )
                        },
                      )}
                      {typeFilter.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setTypeFilter(new Set())}
                          className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium text-primary hover:bg-primary-soft"
                        >
                          Show all
                        </button>
                      )}
                    </div>
                  )}

                  {tooFarOut && (
                    <p className="mx-1 rounded-2xl bg-surface px-3 py-3 text-sm text-muted ring-1 ring-border">
                      Zoom in to see ramps, lifts and step-free doors. At this scale there are too many to show.
                    </p>
                  )}

                  {loadingArea && !tooFarOut && (
                    <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted" role="status">
                      <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                      Loading this area…
                    </p>
                  )}

                  {/* The API spec is for when there's no backend at all; any other
                      failure is a real error and says what went wrong. */}
                  {backendMissing && !loadingArea && <ApiContract />}
                  {areaError && !backendMissing && !loadingArea && (
                    <p role="status" className="mx-1 mb-1 flex items-start gap-2 rounded-2xl bg-[var(--tag-yellow-bg)] px-3 py-2.5 text-sm">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--tag-yellow)' }} aria-hidden="true" />
                      <span>
                        Couldn’t load part of this area: {areaError} It will try again when you move the map.
                      </span>
                    </p>
                  )}
                  {nearby.length === 0 && !loadingArea && !tooFarOut && (
                    <p className="px-3 py-4 text-sm text-muted">
                      {typeFilter.size > 0
                        ? 'None of those in this area. Try another filter, or move the map.'
                        : 'Nothing recorded in this area yet.'}
                    </p>
                  )}
                  <ul>
                    {nearby.map((f) => {
                      const { label, color, bg } = FEATURE_TYPES[f.type]
                      const Icon = FEATURE_ICONS[f.type]
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(f.id)}
                            aria-current={f.id === selectedId ? 'true' : undefined}
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-hover ${f.id === selectedId ? 'bg-primary-soft hover:bg-primary-soft' : ''}`}
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: bg }}>
                              <Icon className="size-4" style={{ color }} aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{f.name}</span>
                              <span className="block truncate text-xs text-muted">
                                {/* The name often already is the label ("Elevator"), so
                                    repeating it underneath just added noise. */}
                                {f.description ?? (f.name.startsWith(label) ? '' : label)}
                                {f.status === 'reported-issue' && ' · Reported issue'}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </aside>

      <div className="absolute inset-0 isolate">
        <LeafletMap
          features={shown}
          paths={paths}
          kerbs={kerbs}
          showWalkable={showWalkable}
          route={route}
          selectedId={selectedId}
          onSelect={setSelectedId}
          myLocation={myLocation}
          locationStatus={locationStatus}
          locationMessage={locationMessage}
          onLocate={locate}
          onBoundsChange={handleBounds}
          pinMode={pinningFor !== null}
          onPinDrop={dropPin}
          contributions={contributions}
          markers={droppedMarkers}
        />
      </div>
    </div>
  )
}

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches
}
