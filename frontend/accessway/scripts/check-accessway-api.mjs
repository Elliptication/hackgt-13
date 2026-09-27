#!/usr/bin/env node

/**
 * Does the AccessWay API do what the frontend expects?
 *
 *   npm run check:api                          # the deployed service
 *   npm run check:api -- http://localhost:8787 # a local wrangler dev
 *   npm run check:api -- --write               # also upload a real photo
 *
 * Deliberately dependency-free and deliberately *not* importing
 * `lib/api/accessway.ts`: this checks the server against the contract, so it has
 * to state the contract itself rather than inherit whatever the client happens
 * to do. If the two ever disagree, that is the bug this finds.
 *
 * Read-only by default. `--write` exercises the three-step upload, which inserts
 * a real feature and contribution row — fine against a dev database, a decision
 * against production.
 */

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const BASE = (
  args.find((a) => !a.startsWith('--')) ??
  process.env.NEXT_PUBLIC_ACCESSWAY_API_URL ??
  'https://api.accessway.tech'
).replace(/\/+$/, '')

/** Georgia Tech, where the demo data lives. */
const AT = { lat: 33.7756, lon: -84.3963, radius: 1 }
const TIMEOUT_MS = 20_000
const TYPES = ['ramp', 'elevator', 'entrance', 'restroom', 'other']

const results = []
let failures = 0

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

/**
 * `detail` is a fact and prints either way; `hint` prints only on a failure.
 *
 * Keeping them apart matters: a passing line that ends "…lands in the Indian
 * Ocean" reads like a warning when it means the opposite.
 */
function record(name, ok, { detail, hint, skipped = false } = {}) {
  results.push({ name, ok, skipped })
  if (!ok && !skipped) failures++
  const mark = skipped ? c.yellow('skip') : ok ? c.green('pass') : c.red('FAIL')
  const note = ok ? detail : (hint ?? detail)
  console.log(`  ${mark}  ${name}${note ? c.dim(` — ${note}`) : ''}`)
}

/** Every call reads text first, so a placeholder worker is named rather than crashing a parse. */
async function call(method, path, { body, headers } = {}) {
  const started = Date.now()
  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, body, headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (err) {
    return {
      ok: false,
      why: err?.name === 'TimeoutError' ? `no answer in ${TIMEOUT_MS / 1000}s` : 'unreachable',
      ms: Date.now() - started,
    }
  }

  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON — reported by the caller */
  }

  return { ok: res.ok, status: res.status, json, text, isJson: json !== null, ms: Date.now() - started }
}

/** A 1x1 PNG, so `--write` sends real image bytes without shipping a fixture. */
function onePixelPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/gFvS5h8AAAAAElFTkSuQmCC',
    'base64',
  )
}

console.log(`\n${c.bold('AccessWay API check')}  ${c.dim(BASE)}\n`)

// ── Is anything there at all? ────────────────────────────────────────────────
const root = await call('GET', '/')

if (root.why) {
  record('the host is reachable', false, { detail: root.why })
  console.log(`\n${c.red('Nothing is answering at that address.')} Is the worker deployed, or the URL right?\n`)
  process.exitCode = 1
} else if (!root.isJson && /hello world/i.test(root.text)) {
  record('the host is reachable', true, { detail: `${root.status} in ${root.ms}ms` })
  record('it is the AccessWay app', false, {
    detail: `plain text "${root.text.trim().slice(0, 30)}" — the wrangler starter worker, not worker.py`,
  })
  console.log(`\n${c.red('The host is up but is not running the app.')} Deploy worker.py, then run this again.\n`)
  process.exitCode = 1
} else {
  record('the host is reachable', true, { detail: `${root.status} in ${root.ms}ms` })
  await checkEverything()
}

async function checkEverything() {
  // ── GET /features ──────────────────────────────────────────────────────────
  const features = await call('GET', `/features?lat=${AT.lat}&long=${AT.lon}&radius=${AT.radius}`)

  if (features.why) {
    record('GET /features', false, { detail: features.why })
  } else if (!features.ok) {
    record('GET /features', false, {
      detail: `${features.status} ${features.json?.detail ?? features.text.slice(0, 60)}`,
    })
  } else if (!Array.isArray(features.json)) {
    record('GET /features', false, {
      detail: `expected a JSON array, got ${features.isJson ? typeof features.json : 'non-JSON'}`,
    })
  } else {
    const rows = features.json
    record('GET /features', true, { detail: `${rows.length} within ${AT.radius} mile, in ${features.ms}ms` })

    if (rows.length === 0) {
      record('features have the expected shape', false, {
        detail: 'nothing came back, so the shape is unchecked',
        skipped: true,
      })
      console.log(
        c.yellow(
          '\n  Note: empty is expected while geo_radius_to_box passes degrees to math.cos —\n' +
            '  the longitude range goes negative and the bounding box inverts. See ACCESSWAY-API.md.\n',
        ),
      )
    } else {
      await checkRows(rows)
    }
  }

  // ── GET /contributions/init, and the upload ────────────────────────────────
  const ticket = await checkInit()
  await checkUpload(ticket)

  // ── CORS, which only a browser would notice ────────────────────────────────
  const cors = await call('GET', `/features?lat=${AT.lat}&long=${AT.lon}&radius=${AT.radius}`, {
    headers: { Origin: 'http://localhost:3000' },
  })
  record('CORS allows a browser to call this', cors.ok, {
    detail: 'preflight aside, the GET is allowed',
    hint: 'the map runs in a browser, so this has to pass',
  })
}

async function checkRows(rows) {
  const row = rows[0]

  const missing = ['id', 'type', 'lat', 'lng', 'status'].filter((k) => row[k] === undefined)
  record('features carry id, type, lat, lng, status', missing.length === 0, {
    detail: JSON.stringify(row).slice(0, 90),
    hint: `missing ${missing.join(', ')}`,
  })
  record('coordinates are named lng, not long', row.lng !== undefined, {
    detail: `${row.lat}, ${row.lng}`,
    hint: 'the frontend reads `lng` in the response body, whatever the query parameter is called',
  })
  record('coordinates are plausible for Atlanta', Math.abs(row.lat - AT.lat) < 1 && Math.abs(row.lng - AT.lon) < 1, {
    detail: `${row.lat}, ${row.lng}`,
    hint: `got ${row.lat}, ${row.lng} — transposed coordinates land in the Indian Ocean`,
  })
  record('type is one of ramp, elevator, entrance, restroom, other', TYPES.includes(String(row.type).toLowerCase()), {
    detail: `"${row.type}"`,
    hint: `got "${row.type}" — anything else falls back to the generic pin`,
  })
  record('status is the verified flag', /^(true|false)$/i.test(String(row.status)), {
    detail: `"${row.status}"`,
    hint: `got "${row.status}", expected "True" or "False"`,
  })
  record(
    'the photo can be shown to a reviewer',
    row.image_path !== undefined || row.image_url !== undefined || row.photo_url !== undefined,
    { hint: 'no image path on the row, so the review queue has nothing to display (ACCESSWAY-API.md #4)' },
  )

  const votable = rows.find((r) => r.contribution_id !== null && r.contribution_id !== undefined)
  record('at least one row can be voted on', Boolean(votable), {
    detail: votable ? `contribution ${votable.contribution_id}` : undefined,
    hint: 'every contribution_id is null, so nothing here can be confirmed',
  })

  // ── GET /contributions/by_feature/{id} ───────────────────────────────────
  const ref = await call('GET', `/contributions/by_feature/${encodeURIComponent(row.id)}`)
  record(`GET /contributions/by_feature/${row.id}`, ref.ok && ref.json?.contribution_id !== undefined, {
    detail: ref.ok ? JSON.stringify(ref.json) : `${ref.status ?? ref.why} ${ref.json?.detail ?? ''}`,
  })

  // ── POST /vote/ ─────────────────────────────────────────────────────────
  if (!votable) return

  const voter = `api-check-${Date.now()}`
  const path = `/vote/?contribution_id=${encodeURIComponent(votable.contribution_id)}&user_id=${voter}&upvote=true`
  const vote = await call('POST', path)
  record('POST /vote/', vote.ok, {
    detail: vote.ok
      ? `${vote.status} in ${vote.ms}ms`
      : `${vote.status ?? vote.why} ${vote.json?.detail ?? vote.text?.slice(0, 60) ?? ''}`,
  })

  if (!vote.ok) return
  const again = await call('POST', path)
  record('the same vote twice is safe to retry', again.ok, {
    detail: 'no error on repeat',
    hint: `${again.status} — the client retries votes, so a repeat must not fail or double-count`,
  })
}

async function checkInit() {
  const init = await call('GET', `/contributions/init?lat=${AT.lat}&lon=${AT.lon}&type=ramp&file_type=.png`)

  if (!init.ok || !init.json?.signed_url || !init.json?.secret || !init.json?.path) {
    record('GET /contributions/init', false, {
      detail: init.ok
        ? `missing ${['secret', 'signed_url', 'path'].filter((k) => !init.json?.[k]).join(', ')}`
        : `${init.status ?? init.why} ${init.json?.detail ?? ''}`,
    })
    return null
  }

  const ticket = init.json
  const absolute = /^https?:/.test(ticket.signed_url)
  record('GET /contributions/init', true, { detail: `path ${ticket.path}` })
  record('the signed URL is absolute', absolute, {
    detail: absolute ? new URL(ticket.signed_url).host : undefined,
    hint: `relative (${ticket.signed_url.slice(0, 40)}) — the client needs NEXT_PUBLIC_SUPABASE_URL to resolve it`,
  })
  return ticket
}

async function checkUpload(ticket) {
  if (!WRITE) {
    record('the upload flow', true, { detail: 'not run — pass --write to insert a real contribution', skipped: true })
    return
  }
  if (!ticket) {
    record('the upload flow', false, { detail: 'no upload ticket to use', skipped: true })
    return
  }

  let put
  try {
    put = await fetch(ticket.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: onePixelPng(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    record('PUT the photo to the signed URL', put.ok, {
      detail: put.ok ? String(put.status) : `${put.status} ${(await put.text()).slice(0, 80)}`,
    })
  } catch (err) {
    record('PUT the photo to the signed URL', false, {
      detail: err?.name === 'TimeoutError' ? 'timed out' : 'unreachable',
    })
  }
  if (!put?.ok) return

  const claim = `/contributions/?lat=${AT.lat}&lon=${AT.lon}&type=ramp&path=${encodeURIComponent(ticket.path)}`
  const created = await call('POST', `${claim}&secret=${encodeURIComponent(ticket.secret)}`)
  record('POST /contributions/', created.ok, {
    detail: created.ok ? `in ${created.ms}ms` : `${created.status ?? created.why} ${created.json?.detail ?? ''}`,
  })
  if (!created.ok) return

  const featureId = created.json?.feature?.data?.[0]?.id
  const contributionId = created.json?.contribution?.data?.[0]?.id
  record('the create response carries the new ids', featureId !== undefined || contributionId !== undefined, {
    detail: `feature ${featureId}, contribution ${contributionId}`,
    hint: 'neither id is in the response, so the client has to re-query for it',
  })

  // The whole point: does it come back out again?
  const after = await call('GET', `/features?lat=${AT.lat}&long=${AT.lon}&radius=${AT.radius}`)
  const found = Array.isArray(after.json) && after.json.some((r) => String(r.id) === String(featureId))
  record('the new feature is returned by /features', found, {
    detail: 'round trip complete',
    hint: 'uploaded, but not findable — check the radius maths and the stored POINT order',
  })

  const replay = await call('POST', `${claim}&secret=wrong-secret`)
  record('a wrong secret is rejected with 401', replay.status === 401, {
    detail: '401',
    hint: `got ${replay.status ?? replay.why} — an unsigned POST must not create rows`,
  })
}

// ── Summary ─────────────────────────────────────────────────────────────────
const skipped = results.filter((r) => r.skipped).length
console.log(
  `\n${failures === 0 ? c.green('All checks passed') : c.red(`${failures} check${failures === 1 ? '' : 's'} failed`)}` +
    c.dim(` · ${results.length - skipped} run, ${skipped} skipped\n`),
)
// Set rather than called: process.exit() with sockets still closing can abort
// the process on Windows before the summary is flushed.
if (failures > 0) process.exitCode = 1
