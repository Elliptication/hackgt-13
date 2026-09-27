'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}

/**
 * True once the page has scrolled more than `offset` pixels.
 *
 * Only re-renders when the answer flips, not on every scroll event: React
 * compares the snapshot, and a boolean only changes at the threshold.
 */
export function useScrolledPast(offset = 0) {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > offset,
    // The server has no scroll position; the page always starts at the top.
    () => false,
  )
}
