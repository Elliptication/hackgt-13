# Reviews: what the API still owes the frontend

The contribute page has two halves. **Writing** is done — an upload goes through
`/contributions/init` → Supabase → `POST /contributions/`, and a vote through
`POST /vote/`. **Reading** does not exist, so the review queue is still seeded
from `data/SampleContributions.ts`.

Four of the six things the review card shows have no server-side source. This is
the whole gap, and it is three endpoints and two columns.

---

## 1. The blocker: the photo is write-only

`POST /contributions/` stores `image_path` in the `contributions` table. No
endpoint ever returns it. A review queue with no photo is not a review queue.

The frontend already builds the URL from a path — `lib/api/accessway.ts:260`,
bucket `contribution_images`:

```
{SUPABASE_URL}/storage/v1/object/public/contribution_images/{image_path}
```

So **return the stored `image_path` string and nothing else is needed.** Do not
build URLs server-side; the frontend already handles absolute and relative.

## 2. Name and description are dropped at the door

`POST /contributions/?lat&lon&type&path&secret` has nowhere to put them, so the
upload form collects both and they die at the boundary. `/features` then returns
`name = v['type']` and `description = ''`, which is why every pin on the map is
literally called "ramp" or "elevator".

The description is not decoration: it is the photo's `alt` text, read aloud to
screen-reader users (`ContributionPhoto.tsx`). On an accessibility app, dropping
it is the wrong bug to ship.

**Schema:** add to `contributions`

| column | type | notes |
|---|---|---|
| `name` | `text not null default ''` | ≤ 80 chars, the form caps it |
| `description` | `text not null default ''` | ≤ 300 chars |

**Then:** accept `name` and `description` on `POST /contributions/`, and return
the real values from `/features` instead of `type` and `''`.

> The secret is an md5 over `lat + lon + type + user_id + date + SECRET`.
> **Do not add name or description to that hash.** They are free text the user
> can retype; binding them would break every upload where the text changed
> between `init` and the POST.

## 3. `GET /contributions/pending` — the queue itself

Requires auth. Returns what *this* user should review: not their own photos, not
ones they have already voted on, not ones already settled.

| Param | Type | Required | Notes |
|---|---|---|---|
| `lat` | float | no | With `long` + `radius`, scope to an area |
| `long` | float | no | |
| `radius` | float | no | Same units as `/features` |
| `limit` | int | no | Default 20 |

Keep the two rules server-side — they already exist implicitly in `vote.py`, and
the client cannot be trusted with them after a reload:

- exclude rows where `contributions.user_id = current_user["id"]`
- exclude rows with a `votes` row for `(contribution_id, current_user["id"])`

```jsonc
[
  {
    "contribution_id": "c-1029",
    "feature_id": 4411,
    "type": "ramp",
    "name": "Clough Commons side ramp",
    "description": "Concrete ramp with handrails on both sides.",
    "lat": 33.7747,
    "lng": -84.3964,
    "image_path": "6a795e6dd02eeac18a9f41e0a4c1d3cc.png",
    "net_votes": 2,
    "total_votes": 3,
    "submitted_by": "104477...",
    "created_at": "2026-09-27T14:10:00Z"
  }
]
```

A bare array matches `/features`. `lng` in the body, never `long` — `?long=` as a
query param is fine.

## 4. `GET /contributions/mine` — "Your photos"

Requires auth. The same row shape plus `verified`, so the Approved / In review /
Not approved badges and the earnings total stop being per-tab state.

```jsonc
[
  { "contribution_id": "c-1030", "feature_id": 4412, "type": "elevator",
    "name": "Van Leer elevator", "description": "Buttons at wheelchair height.",
    "lat": 33.7759, "lng": -84.3973,
    "image_path": "a1b2....png",
    "net_votes": 6, "total_votes": 9, "verified": true,
    "created_at": "2026-09-27T16:42:00Z" }
]
```

## 5. Vote counts, and what "approved" means

The UI currently says "2 of 3 confirmations" because `lib/constants.ts` says
`VOTES_TO_APPROVE = 3`. The server disagrees — `features.py`:

```python
should_verify = net_votes / total_votes > 0.6 and total_votes > 5
```

More than **five** votes and better than a **0.6** ratio. Two different rules for
the same word is how a contributor gets told they were approved when they were
not. Returning `net_votes` and `total_votes` lets the frontend show the real
threshold and delete its own constant.

> `features.py:65` divides before it checks: with `total_votes = 0` that is a
> `ZeroDivisionError`, which surfaces as a 500 with no CORS headers — the same
> confusing shape as the contributions bug. Reorder to `total_votes > 5 and ...`.

## 6. Errors

`{ "detail": "..." }` with a real status code. The frontend surfaces `detail`
straight to the user, so write it for a person.

**Any unhandled exception loses its CORS headers**, because Starlette's error
path runs outside `CORSMiddleware`. The browser then reports a missing
`Access-Control-Allow-Origin` and the real 500 is invisible from the client.
Anything that can raise should be caught and returned as `{ "detail": ... }`.

## 7. Checklist

- [ ] `contributions.name`, `contributions.description` columns
- [ ] `POST /contributions/` accepts `name` + `description` (not in the secret hash)
- [ ] `/features` returns the real `name`, `description`, and `image_path`
- [ ] `GET /contributions/pending` — auth, excludes own and already-voted
- [ ] `GET /contributions/mine` — auth
- [ ] `net_votes` + `total_votes` on every contribution row
- [ ] `total_votes > 5` checked before the division
- [ ] Unhandled exceptions returned as `{ detail }` so CORS headers survive

Once `pending` and `mine` exist, `SAMPLE_CONTRIBUTIONS` and the
`simulateCommunityVote` demo helper both get deleted, and the reducer in
`ContributionsProvider.tsx` keeps only the optimistic layer it needs for the
object-URL photo the uploader just picked.
