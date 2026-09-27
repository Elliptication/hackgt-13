'use client'

import L from 'leaflet'

/**
 * One canvas for everything drawn in bulk: walkable routes, curb dots and the
 * zoomed-out feature dots.
 *
 * It has to be one. A canvas takes every mouse event over its whole area, so
 * with two stacked canvases the top one silently swallowed hovers and clicks
 * meant for the one below — tooltips on routes just stopped appearing.
 *
 * It sits in its own pane just under the overlay pane, so the SVG layers above
 * it (your location dot, a planned route) stay hoverable too.
 */
const PANE = 'accessCanvas'
const renderers = new WeakMap<L.Map, L.Canvas>()

export function sharedCanvas(map: L.Map): L.Canvas {
  let renderer = renderers.get(map)
  if (!renderer) {
    if (!map.getPane(PANE)) map.createPane(PANE).style.zIndex = '390'
    renderer = L.canvas({ padding: 0.5, pane: PANE })
    renderers.set(map, renderer)
  }
  return renderer
}
