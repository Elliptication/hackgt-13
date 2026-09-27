/**
 * Hand-drawn pictograms for the things this map is about.
 *
 * lucide has no lift, no ramp and no curb icon, so the previous markers
 * borrowed whatever looked vaguely close — an up/down arrow for a lift, a
 * right-pointing triangle for a ramp. Nobody reads those correctly.
 *
 * These follow the shapes people already know from signage: a car-and-arrows
 * box for a lift, a figure on a slope for a ramp, a doorway with an arrow going
 * in for an entrance. Recognition beats cleverness on a map someone is using
 * while trying to get somewhere.
 *
 * All are drawn on a 24x24 grid with 2px strokes, matching lucide so they sit
 * consistently beside the icons used elsewhere in the app.
 */

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base({ width, height, stroke, strokeWidth, ...rest }: IconProps) {
  return {
    width: width ?? 24,
    height: height ?? 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: stroke ?? 'currentColor',
    strokeWidth: strokeWidth ?? 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  }
}

/** Lift: the standard shaft-with-arrows sign. */
export function ElevatorIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 10 L11 7.5 L13 10" />
      <path d="M9 14 L11 16.5 L13 14" />
      <path d="M17 8.5 v7" />
    </svg>
  )
}

/** Step-free entrance: a doorway with an arrow going in. */
export function EntranceIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 3 h5 a1 1 0 0 1 1 1 v16 a1 1 0 0 1 -1 1 h-5" />
      <path d="M3 12 h9" />
      <path d="M9 8.5 L12.5 12 L9 15.5" />
    </svg>
  )
}

/** Ramp: a figure rolling up a slope, the shape used on ramp signage. */
export function RampIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 19 L19 19" />
      <path d="M3 19 L15 7" />
      <circle cx="12.5" cy="14.5" r="2.5" />
      <path d="M12.5 12 v-2" />
    </svg>
  )
}

/** Accessible restroom: the wheelchair symbol people look for on a door. */
export function RestroomIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M10 8.5 v5 h5" />
      <circle cx="12" cy="16" r="5" />
      <path d="M15 13.5 L18 19" />
    </svg>
  )
}

/** A curb that drops to road level — you can roll over it. */
export function CurbIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 16 h7 l4 -5 h7" />
      <path d="M3 20 h18" />
    </svg>
  )
}
