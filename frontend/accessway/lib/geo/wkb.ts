/**
 * Read a point out of PostGIS's hex EWKB.
 *
 * `GET /features/{id}` returns the raw `Features` row, and that row stores its
 * position only in `location` — a hex string like
 * `0101000020E61000006B933462B1E340400000008C451955C0`. There are no `lat` or
 * `long` columns filled in, so this is the *only* place a contribution's
 * coordinates exist. Without decoding it, every photo is unplaceable.
 *
 * The format, left to right:
 *
 *   01                byte order, 01 = little-endian
 *   01000020          geometry type, low byte 1 = Point, 0x20000000 = has SRID
 *   E6100000          SRID, 0x10E6 = 4326 (WGS 84)
 *   6B933462B1E34040  first double
 *   0000008C451955C0  second double
 */

export type Point = { lat: number; lng: number }

/** Longitude is the only one of the pair that can exceed ±90. */
const MAX_LAT = 90
const MAX_LNG = 180

/**
 * Decode a hex EWKB point, or null if it is not one we can read.
 *
 * Returns null rather than throwing or guessing: a row whose geometry we cannot
 * parse must read as "no location", never as a point at 0,0 — which is a real
 * place in the Atlantic and would put a pin there.
 */
export function pointFromEwkb(hex: string | null | undefined): Point | null {
  if (!hex) return null

  const clean = hex.trim().replace(/^0x/i, '')
  // Header is 18 hex chars with an SRID, plus 32 for the two doubles.
  if (clean.length < 42 || /[^0-9a-f]/i.test(clean)) return null

  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }

  const view = new DataView(bytes.buffer)
  const order = view.getUint8(0)
  if (order !== 0 && order !== 1) return null
  const little = order === 1

  const type = view.getUint32(1, little)
  // Only a plain Point. A LineString or a 3D point would read two of the wrong
  // numbers as coordinates rather than failing, which is worse than failing.
  if ((type & 0xff) !== 1) return null

  const hasSrid = (type & 0x2000_0000) !== 0
  const offset = hasSrid ? 9 : 5
  if (bytes.length < offset + 16) return null

  const first = view.getFloat64(offset, little)
  const second = view.getFloat64(offset + 8, little)
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null

  return orient(first, second)
}

/**
 * Decide which number is the latitude.
 *
 * The rows in the database are written as `POINT({lat} {lon})`, which is the
 * reverse of the WKT convention — WKT is `POINT(x y)`, and x is longitude. So
 * the stored order is latitude first, and that is what we read.
 *
 * Rather than hard-code that, the pair is checked against what is possible:
 * only longitude can exceed ±90, so a first value beyond that settles it. This
 * way the day somebody corrects the insert to standard `POINT(lon lat)`, these
 * rows keep decoding instead of silently landing in the wrong hemisphere.
 *
 * Inside ±90 both readings are legal and the stored order is the tiebreaker.
 */
function orient(first: number, second: number): Point | null {
  const firstCouldBeLat = Math.abs(first) <= MAX_LAT
  const secondCouldBeLat = Math.abs(second) <= MAX_LAT

  // Unambiguous: only one of them can be a latitude at all.
  if (!firstCouldBeLat && secondCouldBeLat) return valid({ lat: second, lng: first })
  if (firstCouldBeLat && !secondCouldBeLat) return valid({ lat: first, lng: second })

  // Both plausible, so trust how the writer stores it: latitude first.
  return valid({ lat: first, lng: second })
}

function valid(point: Point): Point | null {
  if (Math.abs(point.lat) > MAX_LAT || Math.abs(point.lng) > MAX_LNG) return null
  // 0,0 is in the Gulf of Guinea. It is far more often an unset column than a
  // real position, and a pin in the ocean is worse than no pin.
  if (point.lat === 0 && point.lng === 0) return null
  return point
}
