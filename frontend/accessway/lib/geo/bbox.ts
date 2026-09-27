/**
 * Bounding boxes, and the one place the coordinate order is translated.
 *
 * Our API speaks `minLng,minLat,maxLng,maxLat` (the WMS/GeoJSON convention),
 * while OpenStreetMap's endpoints want them corner-by-corner. Getting this
 * backwards is the classic map-team bug — a route drawn in the Indian Ocean —
 * so the conversion happens here and nowhere else.
 */

export type Bbox = { south: number; west: number; north: number; east: number }

/** Georgia Tech + Midtown, used when a caller doesn't pass one. */
export const DEFAULT_BBOX: Bbox = { south: 33.77, west: -84.408, north: 33.784, east: -84.388 }

export function parseBbox(value: string | null): Bbox {
  if (!value) return DEFAULT_BBOX
  const [minLng, minLat, maxLng, maxLat] = value.split(',').map(Number)
  if ([minLng, minLat, maxLng, maxLat].some((n) => !Number.isFinite(n))) return DEFAULT_BBOX
  return { south: minLat, west: minLng, north: maxLat, east: maxLng }
}
