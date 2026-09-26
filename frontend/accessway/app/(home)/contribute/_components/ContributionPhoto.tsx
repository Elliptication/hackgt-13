/* eslint-disable @next/next/no-img-element -- user uploads are local object URLs, not optimizable */
import { ImageIcon } from 'lucide-react'

import type { Contribution } from '@/types/contribute'
import { FEATURE_TYPES } from '@/data/FeatureTypes'

/** Shows the uploaded photo, or a soft placeholder for sample data with no image */
export function ContributionPhoto({
  contribution,
  className = '',
}: {
  contribution: Pick<Contribution, 'photoUrl' | 'description' | 'type'>
  className?: string
}) {
  if (contribution.photoUrl) {
    return <img src={contribution.photoUrl} alt={contribution.description} className={`object-cover ${className}`} />
  }

  const { icon: Icon, color, bg } = FEATURE_TYPES[contribution.type]
  return (
    <div
      role="img"
      aria-label={`Sample photo: ${contribution.description}`}
      className={`grid place-items-center ${className}`}
      style={{ background: bg }}
    >
      <span className="flex flex-col items-center gap-1 text-xs text-muted">
        <Icon className="size-8" style={{ color }} aria-hidden="true" />
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="size-3" aria-hidden="true" /> Sample photo
        </span>
      </span>
    </div>
  )
}
