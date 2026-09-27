import { Accessibility } from 'lucide-react'
import type { ComponentType } from 'react'

import { ElevatorIcon, EntranceIcon, RampIcon, RestroomIcon } from '@/components/AccessIcons'
import type { FeatureType } from '@/types/features'

import type { SVGProps } from 'react'

/** Matches both our hand-drawn SVGs and lucide's components. */
type IconProps = SVGProps<SVGSVGElement>

/**
 * Presentation-only override of the icons in data/FeatureTypes.ts.
 *
 * That file borrows generic lucide glyphs — an up/down arrow for a lift, a
 * right-pointing triangle for a ramp — because lucide has no icon for either.
 * These are the shapes from real signage instead, so a pin reads correctly
 * without a legend.
 *
 * Kept separate rather than edited into data/FeatureTypes.ts so the colour and
 * label definitions there stay the single source of truth, and so this doesn't
 * collide with work in that file.
 */
export const FEATURE_ICONS: Record<FeatureType, ComponentType<IconProps>> = {
  elevator: ElevatorIcon,
  accessible_entrance: EntranceIcon,
  ramp: RampIcon,
  restroom: RestroomIcon,
  other: Accessibility,
}
