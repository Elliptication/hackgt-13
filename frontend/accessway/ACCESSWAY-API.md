# The AccessWay API — what the frontend now calls

Our own backend (`backend/` on the `backend` branch, a FastAPI app on a
Cloudflare Python Worker). It owns the half of the map that no data source can
give us: **what people have added, the photos behind it, and whether the
community believes them.**

It is wired up. Every endpoint in `backend/routers/` has a call site here, and
the parameter names match exactly — verified against a stub that speaks the
documented contract.

This is a *separate* service from the one in `BACKEND.md`. That one serves the
map its bulk data (places, sidewalks, routing) with a bbox and `{ items, total }`;
this one takes a point and a radius and answers with a bare array. Two contracts,
so two clients, each configured on its own.

```bash
# .env.local
NEXT_PUBLIC_ACCESSWAY_API_URL=https://api.accessway.tech
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co   # optional, see below
```

## Where each endpoint is called

| Endpoint | Frontend | What it does there |
|---|---|---|
| `GET /features?lat&long&radius` | `hooks/useCommunityFeatures.ts` | Community features on the map, loaded per map cell. Confirmed ones go on the map; unconfirmed are held back. |
| `GET /contributions/init` | `lib/api/accessway.ts` → `contributePhoto` | Step 1 of an upload |
| `PUT` to `signed_url` | same | Step 2 — the photo goes straight to Supabase, never through the API |
| `POST /contributions/` | same | Step 3, claiming the upload |
| `GET /contributions/by_feature/{id}` | same | Fallback when the create response does not carry the contribution id |
| `POST /vote/` | `components/ContributionsProvider.tsx` | Confirm or reject, from the review queue |

`lib/api/accessway.ts` is the only file that knows this contract. Everything
above the line works in `AccessFeature` / `Contribution`, so a change in the wire
format is one file to edit.

### The radius is in miles

`geo_radius_to_box` divides by 69, which is degrees-per-mile. The map thinks in
metres, so `useCommunityFeatures` converts. Map cells are quantised to the same
slippy tiles as the basemap, so the same cell is always the same
`lat`/`long`/`radius` — cacheable on both sides, and a drag does not fire a
request per frame.

### Why `NEXT_PUBLIC_SUPABASE_URL`

`/contributions/init` returns a storage **path**, and `/features` never mentions
the image at all, so there is no URL anywhere in the API. That variable is what
turns a path into `…/storage/v1/object/public/contribution_images/<path>`.
Uploads work without it; reading the photo back does not.

---

## Blockers, in the order they will bite

### 1. `/features` returns nothing, although the rows exist

The worker is deployed and answering (2026-09-27): `/` returns `"hello world!"`,
`/docs` serves Swagger, and `/contributions/init` hands back real Supabase signed
URLs. But the endpoint the map depends on is empty:

```
GET /features?lat=33.7756&long=-84.3963&radius=1    → []
GET /features?lat=33.7756&long=-84.3963&radius=50   → []
```

That is not an empty table. Reading the same data the other way round finds it:

```
GET /contributions/by_feature/2  → { "contribution_id": null }
GET /contributions/by_feature/4  → { "contribution_id": 2 }
GET /contributions/by_feature/5  → { "contribution_id": 3 }
GET /contributions/by_feature/6  → 404 Feature not found
```

So features 2–5 are in the table, two of them with contributions, and the radius
query cannot find any of them. **This is the single thing standing between the
frontend and a working map.** The arithmetic in the next section explains it, and
`npm run check:api` reproduces it in one command.

(Earlier the same host served the wrangler starter worker — `200 Hello world`
on every path. The client still recognises that state and names it, because a
redeploy can bring it back and an uptime check would call it healthy.)

### 2. `geo_radius_to_box` passes degrees to `math.cos`

`backend/utils.py`:

```python
long_range = radius / (69.17 * math.cos(lat))   # lat is in degrees
```

`math.cos` wants radians. At Atlanta's latitude `cos(33.7756) = -0.71`, so
`long_range` comes out **negative** and the box is inverted:

```
lat=33.7756 long=-84.3963 radius=1  →  min_long -84.3759,  max_long -84.4167
```

`min_long > max_long`, so `nearby_features` is asked for an empty strip and
`/features` will return `[]` no matter what is in the table. Fix:

```python
long_range = radius / (69.17 * math.cos(math.radians(lat)))
```

### 3. Check the coordinate order going into PostGIS

`contributions.py` inserts `f'POINT({lat} {lon})'`. PostGIS `POINT` is `(x y)` —
longitude first — while `/features` reads the columns back as
`'lat': v['lat'], 'lng': v['long']`. If `nearby_features` derives those from the
geometry, every contribution is stored transposed and lands in the Indian Ocean.
Worth one query to confirm before the demo.

### 4. A reviewer cannot see the photo they are voting on

Nothing returns `contributions.image_path`. `/features` gives id, type, lat, lng,
status and `contribution_id`; `/contributions/by_feature/{id}` gives the id
again. So the review queue can only show photos uploaded in the current session,
which are still in memory as object URLs.

Smallest fix: add `image_path` (or a signed/public URL) to the `/features` rows.
Then the queue works across devices, and `contributionPhotoUrl()` in
`lib/api/accessway.ts` already knows what to do with a path.

### 5. There is no "what needs reviewing" endpoint

The queue currently works from features with `verified = false`, which means it
can only review what happens to be near the map. A
`GET /contributions/pending?limit=` — oldest first, with the image path — would
be a better fit, and is the last piece the contribute page needs.

### 6. `name` and `description` are collected but thrown away

The upload form asks for both (the description doubles as the photo's alt text,
so a screen-reader user hears something useful). `POST /contributions/` accepts
neither, and `/features` returns `'name': v['type'], 'description': ''`. Every
community feature therefore renders as a bare "Ramp" with nothing underneath.
Two nullable columns and two more query parameters.

### 7. Auth is stubbed, and votes are unauthenticated

`user_id = 'heyyo'` is hardcoded in both contribution routes, and `/vote/` takes
`user_id` as a query parameter — so anyone can vote as anyone, as often as they
have ids. The JWT from `routers/auth.py` is already issued as an httpOnly
cookie; reading the voter from that instead would close both.

Frontend note: login here is `components/AuthProvider.tsx`, which is in-memory
and resets on reload. When Google OAuth is live, the id the API sees and the id
`useAuth()` returns have to be the same one, or votes and uploads will be
attributed to different people.

---

## Verified, and how

Against the live service with `npm run check:api`: the host answers, CORS allows
a browser, `/contributions/init` returns a usable signed URL, and `/features`
answers with an empty array. The upload flow is not exercised by default because
it inserts rows — `npm run check:api -- --write` does that deliberately.

Against a stub implementing the documented contract, driven through the real
client:

```
GET  /features?lat=33.7756&long=-84.3963&radius=1
GET  /contributions/init?lat=33.7756&lon=-84.3963&type=ramp&file_type=.jpg
PUT  <signed_url>                                    ← the file's bytes
POST /contributions/?lat=…&lon=…&type=ramp&path=a1b2c3.jpg&secret=…
GET  /contributions/by_feature/12
POST /vote/?contribution_id=42&user_id=user123&upvote=true
```

Confirmed along the way: `"True"`/`"False"` becomes a boolean, an unrecognised
`type` falls back to `other` rather than a pin with no icon, `.JPG` is sent as
`.jpg`, ids are prefixed so they cannot collide with the OSM-backed endpoints,
and a placeholder worker is reported as "up but not serving the API" instead of
crashing on `JSON.parse`.

The retry policy was checked against a deliberately flaky stub: a `/features`
that fails twice took three attempts and ~950 ms to succeed, while
`POST /contributions/` was attempted exactly **once** — a retry there would
insert the same ramp twice. Failed map cells are retried after 30 s rather than
written off, so the map fills in by itself when a deploy finishes.

## Checklist

- [x] Deploy `worker.py` to `api.accessway.tech`
- [ ] **`math.radians` in `geo_radius_to_box`** — `/features` returns nothing until this lands
- [ ] Confirm the stored `POINT` order matches what `nearby_features` reads back
- [ ] Return the image path from `/features`
- [ ] Add `GET /contributions/pending`
- [ ] Accept and store `name` and `description`
- [ ] Take the voter and the uploader from the JWT, not from a query parameter
