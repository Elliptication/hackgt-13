import type { LucideIcon } from 'lucide-react'
import { Accessibility, ArrowUpDown, DoorOpen, Toilet, TriangleRight } from 'lucide-react'

import type { FeatureType } from '@/types/features'

type FeatureMeta = {
  label: string
  plural: string
  icon: LucideIcon
  /** CSS variable names from globals.css (Notion tag colors) */
  color: string
  bg: string
}

export const FEATURE_TYPES: Record<FeatureType, FeatureMeta> = {
  ramp: { label: 'Ramp', plural: 'Ramps', icon: TriangleRight, color: 'var(--tag-green)', bg: 'var(--tag-green-bg)' },
  elevator: { label: 'Elevator', plural: 'Elevators', icon: ArrowUpDown, color: 'var(--tag-blue)', bg: 'var(--tag-blue-bg)' },
  entrance: {
    label: 'Accessible entrance',
    plural: 'Entrances',
    icon: DoorOpen,
    color: 'var(--tag-purple)',
    bg: 'var(--tag-purple-bg)',
  },
  restroom: {
    label: 'Accessible restroom',
    plural: 'Restrooms',
    icon: Toilet,
    color: 'var(--tag-orange)',
    bg: 'var(--tag-orange-bg)',
  },
  other: { label: 'Other', plural: 'Other', icon: Accessibility, color: 'var(--tag-yellow)', bg: 'var(--tag-yellow-bg)' },
}
