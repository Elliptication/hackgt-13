import { Check, CircleHelp, Minus, X } from 'lucide-react'

import type { WheelchairAccess } from '@/types/places'

/**
 * Four states, never three. "Nobody has checked" is not the same claim as
 * "you cannot get in", and collapsing them would be the most harmful thing this
 * app could do — someone would make a trip on our word and be stranded.
 *
 * Wording rule: never the word "steps". We were using it for two unrelated
 * things — stairs, and the turn-by-turn directions in a route — so "3 steps on
 * this route" was genuinely ambiguous. Stairs are always "stairs" now; a route
 * is made of "directions".
 *
 * Every label names a physical thing at the door, not a rating. "Level access"
 * is signage jargon and "accessible" is a verdict; neither tells you what you
 * will actually meet when you arrive. "No stairs" and "Stairs, no ramp" do.
 */
const STATES = {
  yes: { label: 'No stairs', icon: Check, color: 'var(--tag-green)', bg: 'var(--tag-green-bg)' },
  limited: { label: 'Tight or bumpy', icon: Minus, color: 'var(--tag-orange)', bg: 'var(--tag-orange-bg)' },
  no: { label: 'Stairs, no ramp', icon: X, color: 'var(--tag-red)', bg: 'var(--tag-red-bg)' },
  unknown: { label: 'Not checked', icon: CircleHelp, color: 'var(--muted)', bg: 'var(--hover)' },
} as const

type Props = {
  access: WheelchairAccess
  size?: 'sm' | 'md'
  /**
   * Only pass this when a ramp is actually recorded (OSM `ramp=yes` or a
   * feature of type `ramp`). It must never be inferred from `wheelchair=yes`:
   * that tag means "you can get in", which is often a level threshold and not a
   * ramp at all. Promising a ramp that isn't there is exactly the failure this
   * app exists to prevent.
   */
  ramp?: boolean
}

export function AccessBadge({ access, size = 'md', ramp = false }: Props) {
  const state = STATES[access]
  const { icon: Icon, color, bg } = state
  // A known ramp outranks the generic label: say the useful thing.
  const label = ramp && access !== 'no' ? 'Ramp' : state.label

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      }`}
      style={{ background: bg, color }}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden="true" />
      {label}
    </span>
  )
}
