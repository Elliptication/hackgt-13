import type { AccessFeature } from '@/types/features'
import type { Contribution, Vote } from '@/types/contribute'

import { VOTES_TO_APPROVE } from './constants'

/** "$1.50" / "25¢" — cents below a dollar read better unrounded. */
export function formatCents(cents: number) {
  if (cents < 100) return `${cents}¢`
  return `$${(cents / 100).toFixed(2)}`
}

/** A brand-new report, nobody has confirmed it: visible, but plainly not trusted. */
const FAINTEST = 0.15
/** One yes vote short of confirmed. Kept well below 1 so "almost" never reads as "yes". */
const UNCONFIRMED_MAX = 0.55

/**
 * How solid to draw a feature. Unconfirmed reports stay see-through, from 0.15
 * with no yes votes up to 0.55 one vote short; confirmed reports and surveyed
 * data are fully solid. The jump at the end is on purpose, so the difference
 * between "reported" and "confirmed" is obvious at a glance.
 */
export function reportOpacity(report?: AccessFeature['report']) {
  if (!report) return 1
  const needed = Math.max(report.needed, 1)
  const yes = Math.max(report.yes, 0)
  if (yes >= needed) return 1
  return FAINTEST + (UNCONFIRMED_MAX - FAINTEST) * (yes / (needed - 1 || 1))
}

/**
 * A contribution becomes a map feature: solid once approved, faint while
 * pending (see `report`). The id is prefixed so it can't collide with a
 * feature that came from the API.
 */
export function toFeature(contribution: Contribution): AccessFeature {
  return {
    id: `contribution-${contribution.id}`,
    type: contribution.type,
    name: contribution.name,
    lat: contribution.lat,
    lng: contribution.lng,
    status: 'working',
    photoUrl: contribution.photoUrl,
    report:
      contribution.status === 'approved' ? undefined : { yes: contribution.confirms, needed: contribution.needed ?? VOTES_TO_APPROVE },
  }
}

/**
 * Count one vote and settle the contribution once either side reaches the
 * threshold. Returns a new object; callers treat contributions as immutable.
 *
 * Only ever called on a `pending` contribution — ContributionsProvider filters
 * out already-settled ones, and guards against self-votes and double-votes.
 */
export function applyVote(contribution: Contribution, vote: Vote): Contribution {
  const confirms = contribution.confirms + (vote === 'confirm' ? 1 : 0)
  const rejects = contribution.rejects + (vote === 'reject' ? 1 : 0)
  const needed = contribution.needed ?? VOTES_TO_APPROVE

  return {
    ...contribution,
    confirms,
    rejects,
    status:
      confirms >= needed ? 'approved' : rejects >= needed ? 'rejected' : contribution.status,
  }
}

/**
 * The review page, opened on one map report. The location rides along because
 * the API only looks features up by area, not by id.
 */
export function reviewHref(feature: Pick<AccessFeature, 'id' | 'lat' | 'lng'>) {
  const params = new URLSearchParams({
    tab: 'review',
    feature: feature.id,
    lat: feature.lat.toFixed(6),
    lng: feature.lng.toFixed(6),
  })
  return `/contribute?${params}`
}
