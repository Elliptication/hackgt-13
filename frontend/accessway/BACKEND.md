# Backend handover

Every place, feature, path and route the map shows comes from this API.

> **Not the same service as `api.accessway.tech`.** That one — ours, in
> `backend/` — owns contributions, votes and community features, and is already
> wired up: see **[ACCESSWAY-API.md](ACCESSWAY-API.md)**. This document is about
> the data service behind the map itself.

The frontend ships with stand-in handlers in `app/api/v1/` so it can be demoed
on its own, but they are scaffolding: set `NEXT_PUBLIC_API_BASE_URL` and every
request goes to FastAPI instead, with no component changes. Delete `app/api/`
and `lib/osm/` whenever you like.

When nothing is answering, the map does not show an error — it lists these
endpoints and their shapes in the sidebar, so whoever is looking at it can see
exactly what is still owed.

---

## 1. Point the frontend at the backend

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:6767
```

That is the entire frontend configuration. One variable, nothing else.

## 2. Send the backend these files

| File | Why |
|---|---|
| `API.md` | The spec — endpoints, parameters, response shapes |
| `types/features.ts` | `AccessFeature` |
| `types/places.ts` | `Place`, `Accessibility`, `Paginated` |
| `types/paths.ts` | `PathSegment`, `KerbPoint` |
| `types/routes.ts` | `Route`, `RouteRequest`, `RouteStep` |
| `handoff/transform.reference.ts` | **Working OSM tag translation to port, not rewrite** |
| `handoff/osm-fetch.reference.ts` | How an area is pulled from OSM, and the node cap around it |

That last one matters most. It already encodes which tags mean a lift, how
`wheelchair=yes` becomes an entrance with no stairs, the four-state access
model, and how unnamed features are named after the nearest landmark. It is
tested against real data. Porting it to Python is a fraction of the work of
rediscovering it.

## 3. Five endpoints

```
GET  /features   ?tile= | ?bbox= | ?lat=&long=&radius=     → { items, total }
GET  /paths      same                                      → { items, total, kerbs }
GET  /places     same + ?q= &wheelchair= &category= &limit= → { items, total }
GET  /search     ?q= &bbox=                                → { items, total }
POST /routes     { from, to, avoid[], max_incline_pct }    → { routes }
```

Every request carries the same area three ways — as a tile, a bbox, and a
point with a radius. Use whichever suits; ignore the rest. A real request:

```
GET /features?tile=14/4350/6556
             &bbox=-84.4189,33.7791,-84.3970,33.7974
             &lat=33.788278&long=-84.407959&lng=-84.407959&radius=1437
```

## 4. Exact response shapes

```jsonc
// GET /features
{ "items": [
    { "id": "osm-node-760929140", "type": "entrance", "name": "Publix",
      "lat": 33.7927085, "lng": -84.3978483, "status": "working" }
  ], "total": 1 }

// GET /paths — note the third key
{ "items": [
    { "id": "osm-way-9278205", "kind": "path", "access": "limited",
      "geometry": { "type": "LineString", "coordinates": [[-84.416305, 33.787762]] },
      "surface": "ground", "reason": "ground underfoot" }
  ],
  "total": 1,
  "kerbs": [
    { "id": "osm-node-69216006", "lat": 33.7968311, "lng": -84.4161553,
      "kerb": "unknown", "access": "unknown", "tactile_paving": true }
  ] }
```

## 5. The five things that will break it

1. **`lng`, never `long`, in the response body.** `?long=` as a query parameter
   is fine — both are sent. The JSON field must be `lng`. This is the single
   most likely failure.
2. **`{ items, total }`, never a bare array.**
3. **`type` must be exactly one of** `ramp` `elevator` `entrance` `restroom`
   `other`. Anything else renders a pin with no icon.
4. **`access` must be exactly one of** `yes` `limited` `no` `unknown`, and
   `unknown` must stay distinct from `no`. "Nobody has checked" and "you cannot
   get through" are different claims; collapsing them is how someone ends up
   stranded on our word.
5. **CORS must allow `http://localhost:3000`** — not `["*"]`, which browsers
   reject when credentials are involved.

Errors use FastAPI's own shape, `{ "detail": "..." }`, with a real status code.
The frontend surfaces `detail` directly to the user, so write it for a person.

## 6. One design request: key the cache by the area, not by floats

The map is fast because space is quantised. It asks for fixed ~2.4 km cells, so
the same cell is always the same cache key however the user got there — pan a
little and it is still `tile=14/4350/6556`.

Key storage on the `tile` string, or on the **rounded** `(lat, long, radius)`
triple. Keying on raw floats makes every pixel of pan a cache miss and puts cold
loads back to seconds.

## 7. No bulk import needed

Fetch lazily, per cell, on first request:

```python
@app.get("/features")
def features(tile: str):
    rows = db.query(Feature).filter(Feature.tile_key == tile).all()
    if not rows:                                      # first request for this cell
        elements = fetch_osm_bbox(tile_to_bbox(tile))     # ~11 MB, once, ever
        rows = transform(elements)                         # ported reference file
        db.bulk_save(rows)
    return {"items": rows, "total": len(rows)}
```

Source: `https://api.openstreetmap.org/api/0.6/map.json?bbox=minLng,minLat,maxLng,maxLat`
returns everything in a box — around 34,000 elements for one cell, of which
roughly 100 survive the transform. Ways arrive as node-id lists, so geometry is
assembled from the nodes in the same response. The hard limit is 50,000 nodes
per request, which is why cells are this size.

To make the demo instant from the first click, pre-warm the dozen or so cells
covering the demo area with a loop.

## 8. Search and routing are already solved

`/search` and `/routes` can stay as thin proxies; there is no data to store.

- **Search** → Nominatim, `https://nominatim.openstreetmap.org/search`. Bound it
  to the viewport first (`bounded=1`), and retry unbounded only if nothing is
  found — otherwise a search for "Starbucks" returns one in another state.
- **Routing** → Valhalla, `https://valhalla1.openstreetmap.de/route`, with
  `costing: "pedestrian"` and `costing_options.pedestrian.type: "wheelchair"`.
  Free, no key, and it routes on footways rather than roads.

  Its geometry is an encoded polyline at **precision 6**, not the 5 that most
  decoders assume — worth knowing before debugging a route that lands in the
  wrong country.

## 9. Checklist

- [ ] `cp .env.example .env.local`, set the URL
- [ ] Backend serves the five endpoints above
- [ ] Response uses `lng`, `{items,total}`, and the exact enum strings
- [ ] CORS allows `http://localhost:3000`
- [ ] Storage keyed by tile (or rounded lat/long/radius)
- [ ] Demo area pre-warmed
- [ ] `npm run dev` — map loads, search returns results, a route draws

If a response drifts from `types/`, it surfaces as a TypeScript error rather
than a silent runtime break.
