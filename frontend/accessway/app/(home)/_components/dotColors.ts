import type { FeatureType } from '@/types/features'

/**
 * Hex, not the CSS variables: Leaflet writes these into SVG attributes, where
 * `var()` does not resolve. Same values as the --tag-* colours in globals.css.
 *
 * Its own file so the legend can use it without importing Leaflet, which only
 * runs in a browser.
 */
export const DOT: Record<FeatureType, string> = {
  ramp: '#448361',
  elevator: '#2383e2',
  accessible_entrance: '#9065b0',
  restroom: '#d9730d',
  other: '#cb912f',
}
