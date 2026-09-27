# AccessWay API contract

What the frontend calls today, and what FastAPI needs to serve to replace it.

The frontend never touches OpenStreetMap directly. It calls these five
endpoints. Today they are Next.js route handlers in `app/api/v1/` that query
OSM live; tomorrow they are FastAPI. **Nothing in the UI changes** — only one
environment variable.

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Then delete `app/api/` and `lib/osm/`.

## Conventions

| | |
|---|---|
| Case | `snake_case` on the wire — Pydantic's default, so no transform layer |
| Bounding box | `bbox=minLng,minLat,maxLng,maxLat` (WMS/GeoJSON order) |
| List responses | `{ "items": [...], "total": n }` — never a bare array |
| Errors | `{ "detail": "..." }` with a real status code — FastAPI's default |
| Geometry | GeoJSON `LineString`, coordinates `[lng, lat]` (spec order) |
| CORS | Allow `http://localhost:3000`. **Not** `["*"]` |

TypeScript definitions live in `types/places.ts`, `types/paths.ts`,
`types/routes.ts`, `types/features.ts`. Mirror those as Pydantic models.

---

## `GET /api/v1/search`

Type-ahead destination search. Must be **fast** — it runs on every keystroke
(debounced 350 ms). Back it with a geocoder, not an analytical query engine.

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes | At least 2 characters |
| `bbox` | string | no | Bias results here; search wider only if nothing matches |

Returns `{ items: Place[], total }`.

> We use Nominatim. Searching Overpass took 60 s and got us rate-limited;
> Nominatim answers in ~0.5 s. Search local-first (`bounded=1`), then retry
> unbounded — otherwise a query returns a match in another state.

## `GET /api/v1/places`

Everything worth going to in an area.

| Param | Type | Required | Notes |
|---|---|---|---|
| `bbox` | string | no | Defaults to the demo area |
| `q` | string | no | Substring match on name |
| `category` | string[] | no | Repeatable: `?category=cafe&category=library` |
| `wheelchair` | string[] | no | `yes` \| `limited` \| `no` \| `unknown` |
| `limit` | int | no | |

Returns `{ items: Place[], total }`.

## `GET /api/v1/features`

Elevators, step-free entrances, accessible restrooms, ramps.

| Param | Type | Required |
|---|---|---|
| `bbox` | string | no |

Returns `{ items: AccessFeature[], total }`.

> Give unnamed features a useful name — "Elevator at Clough Commons", not
> "Elevator". Put the specifics in `description`: levels served, door width,
> automatic vs manual.

## `GET /api/v1/paths`

The pedestrian network, judged for passability. This is the navigation layer.

| Param | Type | Required |
|---|---|---|
| `bbox` | string | no |

Returns `{ items: PathSegment[], total, kerbs: KerbPoint[] }`.

Each segment carries `access`: `yes` \| `limited` \| `no` \| `unknown`, and a
`reason` in plain words when it isn't `yes` — "8 steps, no ramp", not "blocked".

> `unknown` is a real answer and must stay distinct from `no`. Telling someone
> a route is fine when nobody has checked is the worst failure this app has.

## `POST /api/v1/routes`

**This one is yours to own.** The current implementation is a placeholder: it
calls OSRM's walking profile, which knows nothing about wheelchairs and will
route along a road or down steps. Every route it returns is labelled unchecked.

```json
{
  "from": { "lat": 33.7756, "lng": -84.3963 },
  "to":   { "lat": 33.7790, "lng": -84.3890 },
  "avoid": ["stairs", "steep", "unpaved"],
  "max_incline_pct": 8
}
```

Returns `{ routes: Route[] }`, best first.

Use **OpenRouteService's `wheelchair` profile** — free API key, and it already
understands kerb height, surface, smoothness and incline:

```
POST https://api.openrouteservice.org/v2/directions/wheelchair/geojson
```

Then fill in the fields that make us different from every other map:

| Field | Meaning |
|---|---|
| `step_free` | Nothing known blocks it |
| `warnings[]` | What is on the route, in plain words |
| `steps[].hazard` | `stairs` \| `steep` \| `unpaved` \| `construction` \| `no_curb_cut` |
| `steps[].surface` | From the OSM `surface` tag |
| `max_incline_pct` | Steepest section |

Target: **under 2 s**. The frontend shows a spinner and nothing else.

---

## Two things learned the hard way

**Don't call Overpass per request.** It is an analytical engine on shared
infrastructure. A narrow query answers in 2 s; a slightly wider one returns
HTTP 504; ask repeatedly and you are cut off — which happened to us. Snapshot
the area into Postgres (PostGIS if you have it) on a schedule and serve from
that. Every mapping product works this way.

**Overpass can return HTTP 200 with a broken body.** Under load it streams
valid JSON, times out partway, and appends an HTML error block — status long
since flushed as 200. Read the response as text and check it before parsing, or
you get a JSON syntax error at a random byte offset. See `lib/osm/overpass.ts`.
