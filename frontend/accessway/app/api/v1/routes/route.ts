import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { LatLng } from '@/types/places'
import type { Route, RouteRequest, RouteStep } from '@/types/routes'
import { fail } from '../_shared'

/**
 * POST /api/v1/routes — wheelchair routing via Valhalla.
 *
 * Not OSRM's public demo server: that host only has the car graph loaded, so
 * /foot/, /walking/ and /driving/ return byte-identical routes. It was sending
 * wheelchair users down roads because it had no pedestrian network at all.
 *
 * Valhalla's public FOSSGIS instance is free, needs no key, and has real
 * pedestrian costing — including `type: "wheelchair"` with a maximum grade and
 * a penalty for stairs. It routes on footways, which is the whole job.
 */

const VALHALLA = 'https://valhalla1.openstreetmap.de/route'

const EARTH_RADIUS_M = 6_371_000
const toRad = (d: number) => (d * Math.PI) / 180

function haversine(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Valhalla encodes geometry as a polyline at precision 6 — Google's format, and
 * most decoders you will find, use precision 5. Getting it wrong puts the route
 * a few hundred kilometres away rather than failing loudly.
 */
function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = 10 ** precision
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    // GeoJSON order: [lng, lat].
    coordinates.push([lng / factor, lat / factor])
  }

  return coordinates
}

type Maneuver = {
  instruction?: string
  length?: number
  time?: number
  begin_shape_index?: number
  type?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RouteRequest
    const { from, to, avoid = [] } = body

    if (!from || !to) {
      return NextResponse.json({ detail: 'Both a starting point and a destination are required.' }, { status: 422 })
    }
    if (haversine(from, to) < 1) {
      return NextResponse.json({ detail: 'The start and the destination are the same place.' }, { status: 422 })
    }

    const avoidStairs = avoid.includes('stairs')

    const res = await fetch(VALHALLA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'AccessWay-HackGT/1.0 (student project)' },
      body: JSON.stringify({
        locations: [
          { lat: from.lat, lon: from.lng },
          { lat: to.lat, lon: to.lng },
        ],
        costing: 'pedestrian',
        costing_options: {
          pedestrian: {
            type: 'wheelchair',
            max_grade: body.max_incline_pct ?? 8,
            // A large penalty rather than a hard exclusion: better a route with
            // one bad step, clearly flagged, than no route at all.
            step_penalty: avoidStairs ? 2000 : 600,
            walking_speed: 3.6,
          },
        },
        directions_options: { units: 'kilometers' },
      }),
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(25_000),
    })

    if (!res.ok) {
      return NextResponse.json({ detail: 'The routing service is unavailable right now.' }, { status: 502 })
    }

    const plan = (await res.json()) as {
      error?: string
      trip?: { summary: { length: number; time: number }; legs: { shape: string; maneuvers: Maneuver[] }[] }
    }

    if (plan.error || !plan.trip?.legs?.length) {
      return NextResponse.json({ detail: 'No step-free walking route connects those two points.' }, { status: 422 })
    }

    const leg = plan.trip.legs[0]
    const coordinates = decodePolyline(leg.shape)

    const steps: RouteStep[] = leg.maneuvers.map((m) => {
      const at = coordinates[m.begin_shape_index ?? 0] ?? coordinates[0]
      return {
        instruction: m.instruction ?? 'Continue',
        distance_m: Math.round((m.length ?? 0) * 1000),
        duration_s: Math.round(m.time ?? 0),
        location: { lat: at[1], lng: at[0] },
        surface: null,
        incline_pct: null,
        // Valhalla maneuver types 16 and 17 are stairs up and stairs down.
        hazard: m.type === 16 || m.type === 17 ? 'stairs' : null,
      }
    })

    const stairs = steps.filter((s) => s.hazard === 'stairs').length
    const warnings: string[] = []
    if (stairs > 0) warnings.push(`${stairs} ${stairs === 1 ? 'flight' : 'flights'} of stairs along the way`)
    warnings.push('Routed along footways, avoiding stairs and steep slopes where they are mapped.')

    const route: Route = {
      id: 'valhalla-wheelchair',
      distance_m: Math.round(plan.trip.summary.length * 1000),
      duration_s: Math.round(plan.trip.summary.time),
      geometry: { type: 'LineString', coordinates },
      steps,
      step_free: stairs === 0,
      max_incline_pct: body.max_incline_pct ?? 8,
      accessibility_score: null,
      warnings,
    }

    return NextResponse.json({ routes: [route] })
  } catch (error) {
    return fail(error)
  }
}
