'use client'

import { API_BASE_URL } from '@/lib/api'

/**
 * What the backend owes the map, shown in place of the data it would hold.
 *
 * Not framed as an error. Until FastAPI is serving, an empty map is the normal
 * state of this app, and "something went wrong" would be both untrue and
 * useless. The person looking at this screen is almost always the one who has
 * to make it work — so this is the spec, not a complaint.
 */

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/features',
    params: '?tile=z/x/y',
    returns: '{ items: AccessFeature[], total }',
    note: 'lifts, step-free entrances, restrooms, ramps',
  },
  {
    method: 'GET',
    path: '/paths',
    params: '?tile=z/x/y',
    returns: '{ items: PathSegment[], total, kerbs: KerbPoint[] }',
    note: 'sidewalks and the curbs that make or break them',
  },
  {
    method: 'GET',
    path: '/places',
    params: '?tile · q · wheelchair · category · limit',
    returns: '{ items: Place[], total }',
    note: 'somewhere to go',
  },
  {
    method: 'GET',
    path: '/search',
    params: '?q · bbox',
    returns: '{ items: Place[], total }',
    note: 'type-ahead — must answer fast',
  },
  {
    method: 'POST',
    path: '/routes',
    params: '{ from, to, avoid[], max_incline_pct }',
    returns: '{ routes: Route[] }',
    note: 'wheelchair profile, not walking',
  },
]

export function ApiContract() {
  return (
    <div className="mx-1 rounded-2xl bg-surface p-4 ring-1 ring-border">
      <p className="text-sm font-medium">Waiting on the backend</p>
      <p className="mt-1 text-xs text-muted">
        Point <code className="font-mono text-[11px]">NEXT_PUBLIC_API_BASE_URL</code> at a server that answers
        the following. Currently <code className="font-mono text-[11px] break-all">{API_BASE_URL}</code>.
      </p>

      <ul className="mt-4 space-y-3">
        {ENDPOINTS.map((e) => (
          <li key={e.path} className="text-xs leading-relaxed">
            <span className="flex flex-wrap items-baseline gap-1.5">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium"
                style={{ background: 'var(--tag-blue-bg)', color: 'var(--tag-blue)' }}
              >
                {e.method}
              </span>
              <span className="font-mono font-medium">{e.path}</span>
              <span className="text-[11px] text-subtle">{e.note}</span>
            </span>
            <span className="mt-0.5 block font-mono text-[11px] break-all text-muted">{e.params}</span>
            <span className="block font-mono text-[11px] break-all" style={{ color: 'var(--tag-green)' }}>
              → {e.returns}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-subtle">Full spec and response examples in BACKEND.md</p>
    </div>
  )
}
