import type { AccessFeature } from '@/types/features'
import type { Contribution, Vote } from '@/types/contribute'

import { VOTES_TO_APPROVE } from './constants'

/** "$1.50" / "25¢" — cents below a dollar read better unrounded. */
export function formatCents(cents: number) {
  if (cents < 100) return `${cents}¢`
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * An approved contribution becomes a normal map feature. The id is prefixed so
 * it can't collide with a feature that came from the API.
 */
export function toFeature(contribution: Contribution): AccessFeature {
  return {
    id: `contribution-${contribution.id}`,
    type: contribution.type,
    name: contribution.name,
    description: contribution.description,
    lat: contribution.lat,
    lng: contribution.lng,
    status: 'working',
    photoUrl: contribution.photoUrl,
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

  return {
    ...contribution,
    confirms,
    rejects,
    status:
      confirms >= VOTES_TO_APPROVE ? 'approved' : rejects >= VOTES_TO_APPROVE ? 'rejected' : contribution.status,
  }
}
