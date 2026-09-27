# API Routes

Base URL: `https://api.accessway.tech`

All parameters are passed as **query parameters** (including on `POST` routes).

---

## Features (`features.py`)

### `GET /features`

Returns all features within a radius of a point.

| Param    | Type  | Description        |
| -------- | ----- | ------------------ |
| `lat`    | float | Latitude           |
| `long`   | float | Longitude          |
| `radius` | float | Radius in miles    |

**Example**

```bash
curl "https://api.accessway.tech/features?lat=33.7756&long=-84.3963&radius=1"
```

**Response**

```json
[
  {
    "id": 12,
    "type": "ramp",
    "name": "ramp",
    "description": "",
    "lat": 33.7756,
    "lng": -84.3963,
    "status": "False",
    "contribution_id": "42"
  }
]
```

---

## Contributions (`contributions.py`)

Adding a contribution is a three-step flow:

1. Call `GET /contributions/init` to get a signed upload URL and a `secret`.
2. Upload the image to `signed_url`.
3. Call `POST /contributions/` with the same `lat`, `lon`, `type`, plus the returned `path` and `secret`.

### `GET /contributions/init`

Creates a signed URL for uploading a contribution image.

| Param       | Type   | Description                          |
| ----------- | ------ | ------------------------------------ |
| `lat`       | float  | Latitude                             |
| `lon`       | float  | Longitude                            |
| `type`      | string | Feature type (e.g. `ramp`)           |
| `file_type` | string | File extension, including the dot (e.g. `.jpg`) |

**Example**

```bash
curl "https://api.accessway.tech/contributions/init?lat=33.7756&lon=-84.3963&type=ramp&file_type=.jpg"
```

**Response**

```json
{
  "secret": "5f2b...",
  "signed_url": "https://...supabase.co/storage/v1/object/upload/sign/...",
  "path": "a1b2c3....jpg"
}
```

### `GET /contributions/by_feature/{feature_id}`

Returns the contribution ID for a feature. Returns `404` if the feature doesn't exist.

**Example**

```bash
curl "https://api.accessway.tech/contributions/by_feature/12"
```

**Response**

```json
{ "contribution_id": "42" }
```

### `POST /contributions/`

Creates a new feature and its contribution. The `secret` must match the one from `/contributions/init` (same `lat`, `lon`, `type`, same day), otherwise returns `401`.

| Param    | Type   | Description                            |
| -------- | ------ | -------------------------------------- |
| `lat`    | float  | Latitude                               |
| `lon`    | float  | Longitude                              |
| `type`   | string | Feature type                           |
| `path`   | string | `path` returned by `/contributions/init` |
| `secret` | string | `secret` returned by `/contributions/init` |

**Example**

```bash
curl -X POST "https://api.accessway.tech/contributions/?lat=33.7756&lon=-84.3963&type=ramp&path=a1b2c3.jpg&secret=5f2b..."
```

**Response:** the created feature and contribution records.

---

## Vote (`vote.py`)

### `POST /vote/`

Upvotes or downvotes a contribution. Voting again with the same value does nothing; voting the opposite way flips the vote. After voting, the feature is marked verified if more than 5 votes have been cast and the net/total ratio is above 0.6. Returns `404` if no feature has this contribution.

| Param             | Type   | Description                  |
| ----------------- | ------ | ---------------------------- |
| `contribution_id` | string | Contribution to vote on      |
| `user_id`         | string | Voting user                  |
| `upvote`          | bool   | `true` = upvote, `false` = downvote |

**Example**

```bash
curl -X POST "https://api.accessway.tech/vote/?contribution_id=42&user_id=user123&upvote=true"
```

**Response:** the inserted or updated vote record.
