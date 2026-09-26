'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Accessibility, Camera, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { useContributions } from '@/hooks/useContributions'
import { toFeature } from '@/lib/contribute'
import { Button } from '@/components/Button'
import { UserMenu } from '@/components/Header/UserMenu'
import { useAuth } from '@/hooks/useAuth'
import { FEATURE_TYPES } from '@/data/FeatureTypes'
import { APP_NAME } from '@/lib/constants'
import type { AccessFeature, FeatureType } from '@/types/features'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" aria-hidden="true" />,
})

export function MapView({ features: baseFeatures }: { features: AccessFeature[] }) {
  // Community photos show up on the map once they're approved
  const { contributions } = useContributions()
  const features = useMemo(
    () => [...baseFeatures, ...contributions.filter((c) => c.status === 'approved').map(toFeature)],
    [baseFeatures, contributions],
  )
  const [enabled, setEnabled] = useState<Set<FeatureType>>(() => new Set(Object.keys(FEATURE_TYPES) as FeatureType[]))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 'auto' lets CSS decide on first load: open on desktop, collapsed on phones
  const [panel, setPanel] = useState<'auto' | 'open' | 'closed'>('auto')
  const { user } = useAuth()
  const panelId = useId()

  const visible = useMemo(() => features.filter((f) => enabled.has(f.type)), [features, enabled])
  const presentTypes = useMemo(
    () => (Object.keys(FEATURE_TYPES) as FeatureType[]).filter((t) => features.some((f) => f.type === t)),
    [features],
  )

  function toggle(type: FeatureType) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function selectPlace(id: string) {
    setSelectedId(id)
    // On phones the panel covers the map, so get out of the way to show the place
    if (!isDesktop()) setPanel('closed')
  }

  function togglePanel() {
    setPanel(panelVisible() ? 'closed' : 'open')
  }

  /** Whether the panel is showing right now (auto = open on desktop, closed on phones) */
  function panelVisible() {
    return panel === 'open' || (panel === 'auto' && isDesktop())
  }

  // Shadow only while the panel is showing, so none peeks in at the screen edge when collapsed
  const panelPosition = {
    auto: '-translate-x-full max-md:invisible md:translate-x-0 md:shadow-[4px_0_24px_-8px_rgb(15_15_15/0.25)]',
    open: 'translate-x-0 shadow-[4px_0_24px_-8px_rgb(15_15_15/0.25)]',
    // invisible also takes it out of the Tab order while it's tucked away
    closed: '-translate-x-full invisible',
  }[panel]
  const openButton = { auto: 'flex md:hidden', open: 'hidden', closed: 'flex' }[panel]

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* The one way back in when the sidebar is collapsed */}
      <button
        type="button"
        onClick={togglePanel}
        aria-controls={panelId}
        aria-expanded={false}
        className={`absolute top-3 left-3 z-10 h-11 items-center gap-2 rounded-full bg-background pr-4 pl-3 text-[15px] font-medium shadow-[0_2px_12px_-2px_rgb(15_15_15/0.25)] hover:bg-hover ${openButton}`}
      >
        <PanelLeftOpen className="size-5" aria-hidden="true" />
        {visible.length} places
      </button>

      <aside
        id={panelId}
        aria-label="Sidebar"
        className={`absolute inset-y-0 left-0 z-20 flex w-full flex-col bg-background transition-[translate,visibility] duration-200 ease-out motion-reduce:transition-none md:w-[22rem] ${panelPosition}`}
      >
        {/* Logo (home) and the one collapse button */}
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
          <button
            type="button"
            onClick={togglePanel}
            aria-controls={panelId}
            aria-expanded={true}
            aria-label="Hide sidebar"
            title="Hide sidebar"
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover hover:text-foreground"
          >
            <PanelLeftClose className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Everywhere else you can go, once each */}
        <nav aria-label="Main" className="flex items-center gap-2 border-b border-border px-4 pt-2 pb-3">
          <Button href="/contribute" size="md" className="flex-1">
            <Camera className="size-4" aria-hidden="true" />
            Contribute
          </Button>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button href="/login?next=%2Fmap" variant="ghost" size="md">
              Log in
            </Button>
          )}
        </nav>

        <div className="p-4 pb-3">
          <h1 className="text-lg font-bold">What are you looking for?</h1>
          <fieldset className="mt-3 flex flex-wrap gap-2">
            <legend className="sr-only">Feature types</legend>
            {presentTypes.map((type) => {
              const { plural, icon: Icon, color, bg } = FEATURE_TYPES[type]
              const on = enabled.has(type)
              return (
                <label
                  key={type}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-opacity select-none has-focus-visible:outline-2 has-focus-visible:outline-ring ${on ? '' : 'opacity-45 grayscale'}`}
                  style={{ background: bg }}
                >
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(type)} />
                  <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
                  {plural}
                </label>
              )
            })}
          </fieldset>
        </div>

        <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'place' : 'places'} nearby
        </p>
        <ul className="flex-1 overflow-y-auto p-2">
          {visible.map((f) => {
            const { label, icon: Icon, color, bg } = FEATURE_TYPES[f.type]
            const selected = f.id === selectedId
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => selectPlace(f.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-hover ${selected ? 'bg-primary-soft hover:bg-primary-soft' : ''}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: bg }}>
                    <Icon className="size-4" style={{ color }} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{f.name}</span>
                    <span className="block text-xs text-muted">
                      {label}
                      {f.status === 'reported-issue' && ' · Reported issue'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* The map fills the screen behind the sidebar (last in the DOM so the sidebar comes first when tabbing) */}
      <div className="absolute inset-0 isolate">
        <LeafletMap features={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  )
}

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches
}
