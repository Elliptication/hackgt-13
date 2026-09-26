'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'

import { FEATURE_TYPES, type AccessFeature, type FeatureType } from '@/lib/features'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" aria-hidden="true" />,
})

export function MapView({ features }: { features: AccessFeature[] }) {
  const [enabled, setEnabled] = useState<Set<FeatureType>>(() => new Set(Object.keys(FEATURE_TYPES) as FeatureType[]))
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="order-2 flex max-h-[45%] flex-col border-t border-border bg-background md:order-1 md:max-h-none md:w-80 md:border-t-0 md:border-r">
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
                  onClick={() => setSelectedId(f.id)}
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

      <div className="relative order-1 min-h-0 flex-1 md:order-2">
        <LeafletMap features={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  )
}
