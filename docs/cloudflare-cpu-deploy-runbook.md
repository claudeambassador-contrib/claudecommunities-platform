# Deploy & test runbook — read-side cache / CPU optimization

Step-by-step instructions to provision, deploy, and verify the read-side cache
changes on branch `perf/cloudflare-cpu-optimization`. The *why* and the design
live in [`cloudflare-cpu-optimization.md`](./cloudflare-cpu-optimization.md);
this file is the operational checklist.

**Audience:** someone with `wrangler` authenticated against the Claude Community
Cloudflare account (the one that already owns `claudecommunity-db` and the R2
buckets). Run everything from the repo root.

> **Golden rule:** deploy to **staging first**, run the full test pass there,
> and only then promote to production. Several failure modes in this change are
> silent (they pass the build and only misbehave at runtime).

---

## 0. What this change adds (recap)

- **New bindings** (`wrangler.jsonc`): `NEXT_INC_CACHE_R2_BUCKET` (R2),
  `NEXT_TAG_CACHE_D1` (D1), `WORKER_SELF_REFERENCE` (service),
  `NEXT_CACHE_DO_QUEUE` (Durable Object) — per env.
- **`open-next.config.ts`**: R2 incremental cache + regional cache + D1 tag
  cache + `queue: doQueue` (ISR revalidation) + `enableCacheInterception`.
- **ISR pages**: `/events`, `/courses`, `/cities/[slug]` (`revalidate = 300`).
  Time-based ISR **requires** the DO queue — without it the Worker throws
  `FatalError: Dummy queue is not implemented` on the first stale request.
  The `DOQueueHandler` class is auto-exported by OpenNext's generated
  `worker.js`; it's SQLite-backed, so `wrangler.jsonc` carries a
  `new_sqlite_classes: ["DOQueueHandler"]` migration (the Worker's first DO
  migration — `tag: "v1"`; bump to `v2` for any future DO, never edit `v1`).
  No resource to provision — the DO is created on deploy from the binding.
- **Widget cache**: `community/page.tsx` widgets via `unstable_cache`.
- **Request-scoped Prisma**: one client per request.

The R2/D1 bindings need the resources below to exist; the DO queue and
request-scoped Prisma are independent (no provisioning).

---

## 1. Choose a rollout strategy

Pick one. **Strategy A is recommended** — it isolates the riskiest piece (the
D1 tag cache, which is load-bearing for cache *reads*).

### Strategy A — staged (recommended)
1. **Deploy 1:** R2 incremental cache + `enableCacheInterception`, **`tagCache`
   omitted**. Pages cache and refresh on the time window only. Smallest blast
   radius; proves caching works before the tag cache is in the read path.
2. **Deploy 2:** add `tagCache: d1NextTagCache` + the D1 binding, for on-demand
   `revalidateTag`/`revalidatePath`.

To do Deploy 1, temporarily comment out the `tagCache` line in
`open-next.config.ts` and the `NEXT_TAG_CACHE_D1` blocks in `wrangler.jsonc`.

### Strategy B — all at once
Provision everything in §2, deploy once. Faster, but a misconfigured/un-migrated
tag cache **breaks or degrades cache reads** (see §4 gate 3), so only do this if
you can run the staging test pass immediately after.

---

## 2. Provision Cloudflare resources

These commands create the buckets and tag-cache databases. **Run once per
account.** The `populateCache` step in §3 creates the D1 *table* automatically —
you do **not** hand-write any schema.

```bash
# R2 buckets (incremental cache payloads)
wrangler r2 bucket create ccau-next-cache
wrangler r2 bucket create ccau-next-cache-staging

# D1 databases (tag cache). Each prints a database_id — copy it.
wrangler d1 create ccau-next-tag-cache
wrangler d1 create ccau-next-tag-cache-staging
```

Now edit **`wrangler.jsonc`** and replace the placeholders with the printed ids:

| Placeholder | Block | Paste the id from |
|---|---|---|
| `REPLACE_WITH_TAG_CACHE_D1_ID` (base block) | top-level `d1_databases` | `ccau-next-tag-cache` |
| `REPLACE_WITH_TAG_CACHE_D1_ID` (production block) | `env.production.d1_databases` | `ccau-next-tag-cache` |
| `REPLACE_WITH_STAGING_TAG_CACHE_D1_ID` (staging block) | `env.staging.d1_databases` | `ccau-next-tag-cache-staging` |

> The base block and `env.production` intentionally point at the **same** prod
> tag-cache DB (the base block is used for local `wrangler dev`; in production
> the `--env production` block wins). Staging uses its own.

Sanity-check the config + that the resources resolve (no full build needed):
```bash
wrangler r2 bucket list | grep ccau-next-cache      # both buckets present
wrangler d1 list | grep ccau-next-tag-cache         # both DBs present, note ids match wrangler.jsonc
```
(The real binding validation happens at `opennextjs-cloudflare deploy` time,
since the worker entry `.open-next/worker.js` only exists after the build.)

---

## 3. Wire `populateCache` into the deploy flow (required)

The existing `staging:deploy` / `production:deploy` scripts build then deploy,
but **do not populate the cache** — without this the R2 store starts empty and,
critically, the D1 `revalidations` table is never created. Add a populate step
**between build and deploy**.

Run the build first, then populate, then deploy. Easiest is to do it manually
the first time:

```bash
# STAGING — manual sequence (mirrors bun run staging:deploy, with populate added)
set -a && . ./.env.staging && set +a
rm -rf .open-next .next
bun run build:cf
DEPLOY_TARGET=cloudflare opennextjs-cloudflare populateCache remote --env staging
DEPLOY_TARGET=cloudflare opennextjs-cloudflare deploy --env staging
```

`populateCache remote --env staging`:
- uploads the prerendered/ISR cache assets to `ccau-next-cache-staging`, and
- runs `wrangler d1 execute NEXT_TAG_CACHE_D1 --remote --env staging` with
  `CREATE TABLE IF NOT EXISTS revalidations (...)` — creating the tag table.

Once verified, bake it into the package.json scripts so future deploys are one command.
Suggested `package.json` edit:

```jsonc
"staging:deploy": "set -a && . ./.env.staging && set +a && rm -rf .open-next .next && bun run build:cf && DEPLOY_TARGET=cloudflare opennextjs-cloudflare populateCache remote --env staging && DEPLOY_TARGET=cloudflare opennextjs-cloudflare deploy --env staging",
"production:deploy": "set -a && . ./.env.prod && set +a && rm -rf .open-next .next && bun run build:cf && DEPLOY_TARGET=cloudflare opennextjs-cloudflare populateCache remote --env production && DEPLOY_TARGET=cloudflare opennextjs-cloudflare deploy --env production",
```

> If you chose **Strategy A**, skip the `populateCache` D1 part on Deploy 1 (no
> tag cache yet) — `populateCache` will just populate R2 and find no D1 binding,
> which is fine. Add it for Deploy 2.

---

## 4. Verify on staging (do not skip)

Open a log stream in one terminal:
```bash
wrangler tail --env staging --format pretty
```

Run the gates in order. **Gates 1–3 are the silent failure modes.**

### Gate 1 — build succeeds, pages are not permanently empty
- Confirm `bun run build:cf` completed without error.
- `/events` and `/courses` prerender at build with **no D1**, so their
  `try/catch → []` can emit an empty shell. Refresh it right after deploy:
  ```bash
  # create/edit any event or course in the admin UI — the write paths call
  # revalidatePath automatically. Or trigger it directly with a no-op edit.
  ```
- Load `https://staging.claudecommunity.com.au/events` — it should show real
  events, not an empty list.

### Gate 2 — `prisma` inside `unstable_cache` survives a cache MISS  ⚠️ highest risk
The community widgets now call `prisma` from inside `unstable_cache`. If
OpenNext's request-context ALS doesn't propagate into that callback, **every
`/community` render throws on a cache miss**. A warm page load can hide it —
force a miss:
```bash
# Force the widget caches to miss, then load the page:
#   easiest: publish a post (invalidates the `posts` tag), then immediately
#   load /community as a logged-in user.
```
- In `wrangler tail`, watch for errors from the widget reads (binding/context
  errors, "getCloudflareContext", "Cannot read properties of undefined").
- **Page must render with the sidebar populated.** If it throws on miss →
  revert **only** Part 2 (see §6), redeploy; Parts 1 & 3 are unaffected.

### Gate 3 — tag cache is healthy (only if `tagCache` is enabled)
A broken/un-migrated tag cache fails on every cached-route **read**
(`isStale`/`hasBeenRevalidated`), which forces re-render every time — defeating
the point.
```bash
# Confirm the table exists:
wrangler d1 execute NEXT_TAG_CACHE_D1 --remote --env staging \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='revalidations';"
# Expect one row: revalidations
```
- In `wrangler tail`, loading `/events` twice should NOT log D1 errors mentioning
  `revalidations`.

### Gate 4 — caching actually happens (the CPU win)
```bash
# Two requests; compare cache status header. (curl -sI for headers only.)
curl -sI https://staging.claudecommunity.com.au/events | grep -i 'x-nextjs-cache\|cf-cache-status\|age'
curl -sI https://staging.claudecommunity.com.au/events | grep -i 'x-nextjs-cache\|cf-cache-status\|age'
```
- Second response should indicate a hit (`x-nextjs-cache: HIT`, or an increasing
  `age`), and in `wrangler tail` the second load should issue **no** D1 queries
  for the events list.

### Gate 5 — on-demand invalidation works (nice-to-have, not a blocker)
- Publish a new event in admin → reload `/events` within a few seconds → it
  appears (didn't wait the full 5 min). If it only updates after 5 min, the tag
  path isn't firing but the TTL backstop is — acceptable, investigate later.

### Gate 6 — Prisma request-scoping under concurrency  ⚠️
```bash
# Hammer a few pages in parallel while watching the tail:
for i in $(seq 1 20); do
  curl -s -o /dev/null https://staging.claudecommunity.com.au/community &
  curl -s -o /dev/null https://staging.claudecommunity.com.au/events &
done; wait
```
- In `wrangler tail`, you must see **zero** occurrences of
  `Cannot perform I/O on behalf of a different request`. If any appear, the
  `ctx` key isn't per-request on this runtime → revert **only** `src/lib/prisma.ts`
  (see §6).

### Gate 7 — sanity on personalized pages
- Sign in as two different users in separate browsers; each must see their own
  data on `/community` (no cross-user bleed). This re-checks the `getCurrentUser`
  `cache()` memoization from the earlier commit too.

---

## 5. Promote to production

Only after gates 1–7 pass on staging:
```bash
# If you baked populateCache into the script:
bun run production:deploy

# Or the manual sequence:
set -a && . ./.env.prod && set +a
rm -rf .open-next .next
bun run build:cf
DEPLOY_TARGET=cloudflare opennextjs-cloudflare populateCache remote --env production
DEPLOY_TARGET=cloudflare opennextjs-cloudflare deploy --env production
```
Immediately after: trigger a content edit (or `revalidatePath`) so `/events`
and `/courses` aren't serving an empty build shell, then re-run gates 2, 4, 6
against `https://claudecommunity.com.au`.

---

## 6. Rollback (per-part — they're independent)

Each layer can be backed out without touching the others.

| Symptom | Revert | How |
|---|---|---|
| `/community` throws on cache miss (gate 2) | **Part 2 only** | In `src/app/community/page.tsx`, change the `unstable_cache(fn, keys, opts)` widgets back to plain `async function` calls (or `git revert` just that file's hunk). Redeploy. |
| `Cannot perform I/O...` under load (gate 6) | **Part 3 only** | Restore the old `createD1Client` in `src/lib/prisma.ts` (fresh client per call — `git show b5c5890^:src/lib/prisma.ts`). Redeploy. |
| Pages don't cache / tag-cache errors (gates 3–4) | **Part 1 tagCache** | Comment out `tagCache:` in `open-next.config.ts` + the `NEXT_TAG_CACHE_D1` bindings; redeploy (falls back to TTL-only). |
| `Dummy queue is not implemented` on stale ISR pages | **ISR flips** | The DO queue (`queue: doQueue` + `NEXT_CACHE_DO_QUEUE` binding) is what powers time-based revalidation — don't drop it while ISR pages exist. If you must, revert the ISR pages to `force-dynamic` (row below); then `queue`/the DO binding can be removed too. |
| Anything page-level is wrong | **ISR flips** | Restore `export const dynamic = "force-dynamic"` on the three pages. |
| Total backout | everything | Deploy the previous release: `git checkout main && bun run production:deploy`. |

The cache stores are additive — leaving the R2 buckets / D1 tag DB in place
after a rollback is harmless (nothing reads them once the config is reverted).

---

## 7. Monitor the result

The whole point is Worker CPU time. After production deploy:
- **Workers & Pages → ccau → Metrics → CPU time.** Compare median/p99 over the
  days before vs after. Use the **per-route** breakdown to see whether public
  pages (now cached) dropped and whether `/community` improved from the widget
  cache + Prisma scoping.
- **D1 → Metrics → Rows read** should also fall (cache hits skip queries), a
  useful secondary signal even though CPU is the target.
- Watch error rate for a day — a spike in 5xx on `/community` or the ISR pages is
  the signal to hit the matching rollback above.
