/**
 * Slippy-map tiles — the addressing scheme every web map uses.
 *
 * The problem with fetching by viewport is that no two viewports are ever the
 * same, so every nudge of the map is a fresh request and a cold cache. Pan one
 * block and you pay for the whole area again.
 *
 * Tiles fix this by quantising space. The world is cut into a fixed grid, and
 * data is fetched, cached and keyed per cell. Moving the map then asks only for
 * the cells you have not already seen — usually none, often one — and panning
 * back is instant because those cells are still in memory.
 *
 * This is the same z/x/y scheme the basemap images use, so our data grid lines
 * up with the tiles Leaflet is already drawing.
 */

import type { Bbox } from './bbox'

/**
 * Zoom 14: roughly 2.4 km across at this latitude, ~0.022 degrees of longitude.
 *
 * Chosen to sit just under the OSM API's 50,000-node ceiling — one tile of a
 * dense city centre fits in a single request, so a tile never needs splitting.
 * Larger tiles blow the cap; smaller ones multiply the number of requests.
 */
export const DATA_ZOOM = 14

/**
 * Below this map zoom we load nothing at all.
 *
 * At city scale a doorway pin is meaningless — a few hundred of them land on
 * the same handful of pixels — and the viewport covers hundreds of data cells.
 * Fetching even three of those is ~33 MB for something nobody can read.
 *
 * So the map simply stops asking, and says so. This is what every map does:
 * detail appears when you are close enough for it to mean something.
 */
export const MIN_DATA_ZOOM = 15

export type Tile = { z: number; x: number; y: number }

export const tileKey = (t: Tile) => `${t.z}/${t.x}/${t.y}`

export function parseTileKey(key: string): Tile | null {
  const [z, x, y] = key.split('/').map(Number)
  if (![z, x, y].every(Number.isFinite)) return null
  if (z < 0 || z > 22) return null
  const n = 2 ** z
  if (x < 0 || x >= n || y < 0 || y >= n) return null
  return { z, x, y }
}

function lngToX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

function latToY(lat: number, z: number) {
  // Web Mercator: clamped because the projection has no poles.
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const rad = (clamped * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

function xToLng(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180
}

function yToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/**
 * The same tile expressed as a point and a radius.
 *
 * Some backends take `?lat=&long=&radius=` rather than a box, which is a
 * perfectly normal way to ask "what is near here". The catch is that feeding it
 * a raw map centre gives a different value on every pixel of pan, so nothing is
 * ever a cache hit.
 *
 * Deriving the circle from the tile keeps the quantisation: the same cell always
 * produces the same lat/long/radius, so it stays cacheable on both sides. The
 * radius covers the tile's corners, so nothing inside the cell is missed.
 */
export function tileToCircle(tile: Tile) {
  const b = tileToBbox(tile)
  const lat = (b.north + b.south) / 2
  const lng = (b.east + b.west) / 2

  // Half the diagonal, in metres. 111_320 m per degree of latitude; longitude
  // degrees shrink with the cosine of the latitude.
  const halfLat = ((b.north - b.south) / 2) * 111_320
  const halfLng = ((b.east - b.west) / 2) * 111_320 * Math.cos((lat * Math.PI) / 180)

  return { lat, lng, radius: Math.round(Math.hypot(halfLat, halfLng)) }
}

export function tileToBbox(tile: Tile): Bbox {
  return {
    west: xToLng(tile.x, tile.z),
    east: xToLng(tile.x + 1, tile.z),
    north: yToLat(tile.y, tile.z),
    south: yToLat(tile.y + 1, tile.z),
  }
}

/**
 * Which tiles cover this viewport.
 *
 * Capped because a zoomed-out view can span thousands of cells, and nobody
 * needs doorway-level detail at city scale. When the cap is hit we return the
 * tiles around the centre of the screen — where the user is looking.
 */
/**
 * The ring of cells immediately around a set of tiles.
 *
 * Fetched quietly once the visible ones have landed, so panning one block into
 * a neighbour is instant instead of a three-second wait. This is the oldest
 * trick in web mapping: load slightly more than the screen needs, while nobody
 * is waiting.
 */
export function neighboursOf(tiles: Tile[]): Tile[] {
  const have = new Set(tiles.map(tileKey))
  const ring: Tile[] = []

  for (const t of tiles) {
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        if (dx === 0 && dy === 0) continue
        const n = { z: t.z, x: t.x + dx, y: t.y + dy }
        const k = tileKey(n)
        if (have.has(k)) continue
        have.add(k)
        ring.push(n)
      }
    }
  }

  return ring
}

export function tilesForBbox(bbox: Bbox, zoom = DATA_ZOOM, max = 3): Tile[] {
  const minX = lngToX(bbox.west, zoom)
  const maxX = lngToX(bbox.east, zoom)
  // y runs north to south, so the northern edge gives the smaller index.
  const minY = latToY(bbox.north, zoom)
  const maxY = latToY(bbox.south, zoom)

  const all: Tile[] = []
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) all.push({ z: zoom, x, y })
  }

  // Always centre-first, so a caller loading one tile at a time loads the one
  // being looked at. Each cold tile costs several seconds and ~11 MB upstream,
  // so the order is not cosmetic.
  const centreX = (minX + maxX) / 2
  const centreY = (minY + maxY) / 2
  const byDistance = all.sort(
    (a, b) => (a.x - centreX) ** 2 + (a.y - centreY) ** 2 - ((b.x - centreX) ** 2 + (b.y - centreY) ** 2),
  )

  return byDistance.slice(0, max)
}
