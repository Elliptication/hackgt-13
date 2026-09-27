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
  accessible_entrance: {
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

/** Older names for a type, from before it was renamed. */
const LEGACY_TYPES: Record<string, FeatureType> = { entrance: 'accessible_entrance' }

export function isFeatureType(value: unknown): value is FeatureType {
  return typeof value === 'string' && Object.hasOwn(FEATURE_TYPES, value)
}

/**
 * Any type string from outside the app (the backend, a cached tile) as one the
 * app knows. Old names map to their new ones; anything unrecognised is "other",
 * so a stray value can never leave FEATURE_TYPES[type] undefined.
 */
export function toFeatureType(value: unknown): FeatureType {
  const normalised = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (isFeatureType(normalised)) return normalised
  return Object.hasOwn(LEGACY_TYPES, normalised) ? LEGACY_TYPES[normalised] : 'other'
}
