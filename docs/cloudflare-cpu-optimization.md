# Cloudflare Worker CPU optimization

How rendering works on Cloudflare today, why Worker **CPU time** is climbing
toward the limit, and a prioritized plan to bring it down. Confirmed with the
operator: the alarming dashboard metric is **Worker CPU time**, not D1 rows-read
or request count. (Workflows + Browser Rendering already put us on a paid
Workers plan, so "free tier" pressure is about per-request CPU headroom, not the
request quota.)

## TL;DR — what to do, in priority order

1. **[Biggest lever] Edge-cache the non-personalized pages** via OpenNext's
   incremental cache + `enableCacheInterception`. A cache hit is served
   **without booting NextServer or the page's React code** — that is the only
   change that removes render CPU outright. Clean candidates today:
   `/events`, `/courses`, `/cities/[slug]`, `/for/[slug]`.
2. **Dedupe per-request work on the personalized pages** (community/*). These
   can't be edge-cached (they read the Clerk session), so the win is doing less
   compute per render: ✅ `getCurrentUser()` is now memoized per request, and
   the global feed widgets should move from the per-isolate `Map` to a
   cross-request cache.
3. **Request-scope the Prisma client** so a render builds **one** WASM-backed
   client instead of ~16. CPU-only win; needs preview-testing because of the
   I/O-context constraint (details below).

> **Check the traffic mix before committing to the order above.** The dominant
> per-request render cost is the **logged-in community feed** (20 posts +
> sidebar) — and that page *cannot* be edge-cached (it reads the Clerk session).
> Win #1 only helps the public pages (`/events`, `/courses`, …). If the
> logged-in feed accounts for most CPU-burning requests, then #2 (cross-request
> widget caching + reducing the feed render) moves the needle more than the R2
> incremental-cache + ISR infra, and you should do #2 first. The Workers
> dashboard can break CPU/requests down **by route** — confirm the public-page
> CPU share is meaningful before investing in the ISR infrastructure.

---

## Implementation status (all 3 parts written in code)

All code/config below is committed and typechecks. **It is NOT yet deployed or
runtime-verified** — the worktree has no `node_modules` / Cloudflare access, so
the build, preview, and provisioning steps are yours to run.

**In code:**
- `open-next.config.ts` — R2 incremental cache + `withRegionalCache` + D1 tag
  cache + `enableCacheInterception`.
- `wrangler.jsonc` — `NEXT_INC_CACHE_R2_BUCKET`, `NEXT_TAG_CACHE_D1`,
  `WORKER_SELF_REFERENCE` added to base + production + staging.
- `src/app/events/page.tsx`, `src/app/courses/page.tsx`,
  `src/app/cities/[slug]/page.tsx` — `force-dynamic` → `revalidate = 300`.
  (`/for/[slug]` was **already static** — has `generateStaticParams`, no prisma —
  so it needed no change.)
- `src/lib/revalidate.ts` — `revalidateTagSafe` / `revalidatePathSafe` (Next 16
  needs `revalidateTag(tag, "max")`) + `CACHE_TAGS`.
- Service write paths call them: events (`/events` + `/cities/[slug]` + `events`
  tag), courses & scheduled-courses (`/courses`), posts (`posts` tag).
- `src/app/community/page.tsx` — the 7 global widgets moved from the per-isolate
  `Map` to `unstable_cache` (tags on the post/event-derived ones).
- `src/lib/prisma.ts` — request-scoped client (WeakMap keyed on `ctx`).

**You must provision before deploy (the bindings reference resources that don't exist yet):**
```bash
wrangler r2 bucket create ccau-next-cache
wrangler r2 bucket create ccau-next-cache-staging
wrangler d1 create ccau-next-tag-cache           # paste id → base + production NEXT_TAG_CACHE_D1
wrangler d1 create ccau-next-tag-cache-staging    # paste id → staging NEXT_TAG_CACHE_D1
```
Replace the `REPLACE_WITH_*` `database_id` placeholders in `wrangler.jsonc`.

> **The D1 tag cache is load-bearing for cache *reads*, not just invalidation.**
> `d1NextTagCache.isStale`/`hasBeenRevalidated` are queried on every cached-route
> **read** to decide staleness. If the tag table doesn't exist (placeholder id
> never filled, or schema not migrated), those reads fail — which either errors
> the route or forces a re-render every time, **defeating the CPU win**. A
> half-provisioned tag cache is worse than none. So either:
> - apply OpenNext's tag schema to the new D1 **before** the first deploy that
>   references it (see the [OpenNext caching docs](https://opennext.js.org/cloudflare/caching)), **or**
> - **stage it:** ship `incrementalCache` (R2) + `enableCacheInterception`
>   first with `tagCache` *omitted* (it's optional in the config type), confirm
>   pages cache and refresh on TTL, then add `tagCache: d1NextTagCache` +
>   the D1 binding in a second deploy. Smaller blast radius. (Confirm
>   interception still works with no tagCache — if not, apply the schema first.)

`WORKER_SELF_REFERENCE` points at the worker's own name (`ccau` /
`ccau-staging`) and works once deployed.

**Verification gates (run these — these failure modes are silent at build time, not type errors):**
1. **[highest risk] `prisma` inside `unstable_cache` on a cache MISS.** The Part 2
   widgets call `prisma` (→ `getCloudflareContext()`, an AsyncLocalStorage read)
   from *inside* the `unstable_cache` wrapper — the old `Map` called prisma
   directly, so this is new. If OpenNext's request-context ALS doesn't propagate
   into the cached callback, **every `/community` render throws on cache miss**
   (not caught). Test a genuine **miss**, not just a warm load: deploy, then hit
   `/community` on a cold isolate (or right after a `revalidateTag('posts')`),
   and watch `wrangler tail` for context/binding errors from the widget reads.
   If they appear, revert **only** Part 2's `unstable_cache` wrapping (back to
   direct prisma calls in `community/page.tsx`) — Parts 1 and 3 are independent
   and still deliver.
2. **Prisma request-scoping under concurrency:** open several pages in parallel
   and watch `wrangler tail` for `Cannot perform I/O on behalf of a different
   request`. None should appear. (If any do, the `ctx` key isn't per-request on
   your runtime — revert `src/lib/prisma.ts` to the per-call client; everything
   else is independent.)
3. `opennextjs-cloudflare build` succeeds. `/events` and `/courses` prerender at
   build with **no D1 binding**, so their `try/catch → return []` emits an empty
   shell. Right after deploy, kick `revalidatePath('/events')` /
   `revalidatePath('/courses')` (or just create/edit one event/course — the
   write paths now do it) so the empty shell doesn't linger up to 5 min.
   Consider `experimental: { remoteBindings: true }` in `next.config.ts` if you
   want the build to prerender with real data instead.
4. After deploy, hit `/events` twice — second response should be cache-served
   (no D1 query in `wrangler tail`, cache HIT). Then publish an event and
   confirm `/events` reflects it within seconds (tag/path revalidation).
5. `unstable_cache` is **inert until the R2 store is live** — pre-deploy it
   behaves like the old in-memory `Map` (no regression, no gain). The widget CPU
   savings only appear once `NEXT_INC_CACHE_R2_BUCKET` exists.

> On-demand invalidation is **best-effort by design**: `revalidateTagSafe` /
> `revalidatePathSafe` swallow errors and every cache has a time-based
> `revalidate` backstop, so if `revalidateTag(tag, "max")` doesn't invalidate
> legacy `unstable_cache` tags in this exact OpenNext+Next 16 combo, writes
> still don't crash and content refreshes on TTL (stale-by-seconds, which is
> acceptable here). Worth confirming, but not a deploy gate.

---

## How a request renders today

OpenNext compiles the Next 16 app into a single Worker (`.open-next/worker.js`).
**Every** data-bearing page is `export const dynamic = "force-dynamic"` (35
pages), so there is no static/ISR output and no edge cache — each request boots
the full Worker, runs React Server Component rendering, issues the page's DB
queries, and serializes HTML. Nothing is reused between requests.

Two structural CPU costs per request:

### a) React SSR compute (the dominant cost)
A logged-in community feed view (`src/app/community/page.tsx` +
`layout.tsx`) renders ~20 posts with nested author/space/poll/counts plus a
sidebar of widgets. That React render is pure CPU and runs on every hit. **It
can only be removed by caching the render output** (full-page for public pages;
fragment/island for personalized ones).

### b) Prisma client instantiation (WASM)
`src/lib/prisma.ts` is a Proxy that calls `createD1Client()` —
`new PrismaClient({ adapter: new PrismaD1(env.DB) })` — on **every model-method
access**. The community page fires ~12 queries, the layout ~3, auth ~1–2 ⇒
**~16 fresh PrismaClient instantiations per page view**, each wiring up the
edge/WASM query engine. Building the client is CPU (the part that counts toward
the 10 ms limit); the D1 round-trip itself is I/O wait and does **not** count
against CPU.

> Note on the "access vs CPU" ambiguity: on Workers, **CPU time excludes time
> spent awaiting I/O**. So the ~16 D1 round-trips hurt wall-clock and D1
> rows-read quota, but only the *compute* (SSR + client construction +
> serialization) is the CPU number that's alarming. The plan below targets CPU.

### What caching exists today (and why it barely helps)
- `src/lib/cache.ts` `cached()` is an in-memory `Map` — **per-isolate**. Workers
  spin up many short-lived isolates, so the cross-request hit rate is poor; a
  cold isolate re-runs every query.
- `invalidateCache()` is defined but has **zero callers** — writes never
  invalidate; entries only age out by TTL. The operator's "update the cache when
  things get added" is not implemented anywhere.
- `open-next.config.ts` is the bare `defineCloudflareConfig()` with **no
  `incrementalCache` configured**, which is *why* ISR / `unstable_cache` /
  `revalidateTag` currently have nowhere to store.

---

## Plan

### 1. Configure OpenNext incremental cache (the foundation) + edge-cache public pages

This single piece of infra unlocks both full-page ISR *and* `unstable_cache`
for widget data, with tag-based invalidation on writes (= the operator's "update
when things get added"). Versions in this repo: `next@16.2.6`,
`@opennextjs/cloudflare@^1.19.6`, `react@19`.

**`open-next.config.ts`:**
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
    shouldLazilyUpdateOnCacheHit: true,
  }),
  tagCache: d1NextTagCache,          // small-site option; revalidateTag support
  enableCacheInterception: true,     // serve cached routes WITHOUT booting NextServer — the CPU win
});
```

**`wrangler.jsonc`** (add to base **and** the `production` / `staging` env
blocks — this repo duplicates bindings per env):
```jsonc
// R2 bucket for cached page payloads
{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "ccau-next-cache" },
// D1 binding for the tag cache (can be a new small DB or reuse a dedicated one)
{ "binding": "NEXT_TAG_CACHE_D1", "database_name": "...", "database_id": "..." },
// Self-reference service binding (required by the cache machinery)
{ "binding": "WORKER_SELF_REFERENCE", "service": "ccau" }   // "ccau-staging" in staging
```
Create the bucket with `wrangler r2 bucket create ccau-next-cache` (and a
staging bucket). The tag-cache D1 needs OpenNext's tag schema applied — see the
OpenNext caching docs for the exact init.

**Convert the clean public pages** from `force-dynamic` to time-based ISR:
```ts
// remove: export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min; stale-by-minutes is fine here
```
Verified **clean (0 per-user calls)** and safe to convert now:
`src/app/events/page.tsx`, `src/app/courses/page.tsx`,
`src/app/cities/[slug]/page.tsx`, `src/app/for/[slug]/page.tsx`.

**Needs work before ISR** (they call `auth()`/`getCurrentUser()`, almost
certainly only to show an admin "Edit" affordance or RSVP state):
`src/app/events/[slug]/page.tsx`, `src/app/courses/[slug]/page.tsx`,
`src/app/pricing/page.tsx`. Push that per-user bit into a small client island
(or a separate dynamic segment), then the body can be ISR. Until then, leave
them dynamic and rely on wins #2/#3.

> ⚠️ **Correctness gate:** a page is only edge-cacheable if its cached render
> reads **no per-request state**. Calling `auth()`/`cookies()`/`headers()` opts
> the route back into dynamic rendering regardless of `revalidate`. Audit each
> page for per-user data before converting, or you will serve one user's view to
> everyone. Validate via `bun run preview` and confirm the response carries the
> cache headers / is served on a second hit without re-rendering.

**On-demand invalidation (the "update when things get added" part):** in the
service-layer write paths (`src/lib/services/*`), call `revalidateTag(...)` /
`revalidatePath(...)` after a mutation. e.g. after creating an event, revalidate
the events tag so `/events` refreshes on next hit instead of waiting 5 min.

### 2. Cut per-request compute on the personalized community pages

These read the Clerk session, so they can't be edge-cached as a whole. Reduce
the compute each render does:

- ⚠️ **Applied, NOT yet runtime-verified — `getCurrentUser()` memoized**
  (`src/lib/auth.ts`, wrapped in React `cache()`). It was called by the layout,
  the page, `getCurrentUserWithPermissions()` and `isAdmin()` within one
  render — each call previously re-issued a Clerk lookup + a fresh Prisma D1
  query. The real payoff is concentrated in the **RSC render** path
  (layout + page sharing scope), where `cache()`'s per-request scope is the
  blessed Next pattern. **Caveat:** `getCurrentUser` is *also* reached from
  **route handlers** via `getCurrentUserWithPermissions` → `route-auth.ts`, and
  `cache()`'s scope semantics in route handlers on OpenNext/Cloudflare are not
  the same well-trodden path. If the scope were ever broader than one request
  the failure mode is a **cross-user auth leak** — worse than the CPU problem.
  Probability is low, but this was verified only with `tsc`/biome (the worktree
  has no `node_modules`, so no local preview). **Gate before deploy:** run
  `bun run preview`, sign in as two different users in parallel, and confirm (a)
  each gets their own user record on pages, and (b) the API routes that go
  through `route-auth` return the correct user and don't crash. Route handlers
  were already ~single-call, so if route-handler scope is at all uncertain,
  restrict the memoization to the RSC path (where the benefit actually is) and
  lose almost nothing.
- **Move the global feed widgets to a cross-request cache.** `trendingPosts`,
  `onlineMembers`, `memberStats`, `postCount`, `upcomingEventCount`,
  `topContributors` in `src/app/community/page.tsx` are **identical for every
  user** but today re-query per cold isolate via the in-memory `Map`. Wrap each
  in `unstable_cache(fn, keys, { revalidate, tags })` (backed by the incremental
  cache from step 1) so the result is shared across requests/isolates, and
  `revalidateTag` the relevant tag on the corresponding write. This removes both
  the Prisma-client construction and result-processing CPU for those widgets on
  most renders. (Fragment-caching the rendered sidebar is a bigger follow-up.)

### 3. Request-scope the Prisma client (CPU-only win, needs preview-testing)

Collapse the ~16 `new PrismaClient` builds per render into one. **Do not** use a
module-level singleton — multiple requests share an isolate concurrently, and a
shared client leaks one request's D1 binding into another, producing the exact
`Cannot perform I/O on behalf of a different request` error the current comment
in `prisma.ts` warns about.

Safe shape: memoize on a **per-request** key. The trap: `getCloudflareContext().env`
may be a *stable per-isolate* object (shared across concurrent requests) rather
than per-request — keying a `WeakMap` on `env` would then behave like a global
singleton and reintroduce the crash. The per-request object is the
`ExecutionContext` (`ctx`), so key on that, and fall back to a fresh client when
no `ctx` is available (e.g. the workflow path, which sets only `env` via
`runWithEnv`):

```ts
const clientByCtx = new WeakMap<object, PrismaClient>();
async function createD1Client(): Promise<PrismaClient> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const cfCtx = (await getCloudflareContext({ async: true }));
  const key = cfCtx.ctx as object | undefined;
  const env = cfCtx.env;
  if (key) {
    const hit = clientByCtx.get(key);
    if (hit) return hit;
  }
  const client = new PrismaClient({ adapter: new PrismaD1((env as any).DB) });
  if (key) clientByCtx.set(key, client);
  return client;
}
```
**Must be verified under concurrency** with `bun run preview` (open several
pages in parallel and watch for the I/O-context error) before deploying. Also
worth confirming the payoff is real: if the WASM engine instantiates lazily on
first query rather than in the constructor, the saving from 16→1 *objects* is
smaller than hoped. Keep this change isolated so it's easy to revert.

---

## Verification

- After step 1: `bun run preview`, hit a converted public page twice, confirm
  the second response is cache-served (no DB queries in logs, cache header
  present). Watch CPU in `wrangler tail` (cpuTime is in tail events) / the
  Workers dashboard before vs after.
- After step 2/3: confirm community pages still render correct per-user data and
  no `Cannot perform I/O...` errors appear under concurrent load.
- Track the Workers **CPU time** metric over a few days of real traffic; that is
  the number this work exists to move.

## Risk notes
- ISR on a page that secretly reads per-user state → cross-user data leak.
  Mitigated by the per-page audit + preview check above.
- Prisma request-scoping done wrong → site-wide I/O-context crash. Mitigated by
  ctx-keying + preview-under-concurrency + easy revert.
- KV as the incremental cache store has a low free-tier write ceiling (~1k/day,
  1 write/s/key); prefer the R2 store above for short-TTL data.
