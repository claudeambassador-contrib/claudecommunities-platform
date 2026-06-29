# Multi-tenancy fan-out plan (foundation → full rollout)

**Status 2026-06-16.** The Option A **foundation is built and verified green**
(56 isolation tests, `npm run test:iso`), **`npx tsc --noEmit` is green**, and
**two isolation ratchets are live in `eslint.config.mjs`** (see below). What
remains is the **mechanical fan-out** across the app. This doc is the execution
recipe: what's done, the patterns the remaining work MUST follow, the ordered
steps, and the gotchas discovered while building the foundation.

> ✅ The schema-rescope-broken `findUnique({where:{slug|name}})` callers are all
> migrated; tsc is green. The build going green does **NOT** mean isolation is
> complete — see "Two defects the green build masks" below. Real completion =
> both ESLint backlogs (`PENDING_TENANT_SCOPE`, `PENDING_RAW_SQL_TENANT_AUDIT`)
> are empty AND the surface-hardening + workflow-context work lands.

## The two ratchets (live — make the silent leaks loud)

`eslint.config.mjs` enforces, across all non-route `src/**` (api/MCP are governed
by the stricter route→service `PENDING_SERVICE_MIGRATION`):

1. **No unscoped default `prisma`** (`importNames:["default"]`; named
   `getPrisma`/`getPlatformPrisma` stay allowed). Allowlist: `PENDING_TENANT_SCOPE`.
2. **No raw `@/lib/db`** (`query`/`queryOne`/`run` bypass the chokepoint).
   Allowlist: `PENDING_RAW_SQL_TENANT_AUDIT` (3 files).

Both are folded into ONE `no-restricted-imports` rule (ESLint flat-config keeps
only the last for a file, so two configs would silently override). **Fan-out
complete = both allowlists empty.** `tsc`/`lint`/iso green do NOT prove a file is
isolated (see masked defects) — they prove it compiles and uses no banned import.

### Migrated 2026-06-16 — 23 files → `getPrisma()` (defect #3 now provides the tenant)
**13 request-context pages** (after defect #3 resolved): `admin/courses`, `admin/tiers`,
`courses`, `courses/[slug]`, `pricing`, `community/{events,layout,learn,posts/[id],
settings/profile}`, `events`, `events/[slug]`, `events/[slug]/resources`. Each was
triaged first: no raw-SQL, and no GLOBAL-`User` *list* (User accesses are by-id
own-user = correct global passthrough). The 6 pages that DO list users
(`admin`, `admin/analytics`, `cities/[slug]`, `community/{leaderboard,profile/[id],
search}`) stay on `PENDING_TENANT_SCOPE` — they need the membership join (Step 4),
not a mechanical swap. The codemod (`/tmp/migrate-getprisma.mjs`) needed a fix for
destructured-param page signatures (`Page({` opens a param brace, not the body).

### Migrated 2026-06-16 (10 services → `getPrisma()`)
`activity, badges, claudience, connections, eventAgenda, notifications(service),
polls, scheduled-courses, talkComments, _slug`. Classification was **empirical,
not guessed**: a reverse-dependency scan from the 3 workflows + 2 cron routes +
`worker-scheduled.ts` proved each is unreachable from a non-request entry (so
`getPrisma()` can't throw *from a workflow*). Re-run that scan before migrating
any further service. **Caveat (defect #3 below):** these — like every
`getPrisma()` caller, including the ~18 migrated in earlier batches — require a
tenant in *request* scope, which the platform plane does not yet provide.

## Adversarial verification (2026-06-16) — leaks the green build masked

A read-only workflow ran 2 independent skeptics per migrated file (B1+B2) against the
isolation contract. It surfaced THREE real cross-tenant leaks that tsc/lint/iso did NOT catch
(the advisor's "compiles but leaks" failure mode, confirmed):

1. **`admin/analytics/page.tsx` "Most Active Users" `orderBy:{posts:{_count}}`** — the displayed
   `_count` was tenant-filtered but the sibling `orderBy` relation-count on the GLOBAL `User`
   ranks by GLOBAL post count, so WHICH of this tenant's members appear in the top-5 is
   influenced by other tenants' activity (spec §3 #24). **FIXED**: drop the relation-orderBy,
   fetch active members with tenant-filtered counts, rank in JS.
2. **Scalar-FK cross-tenant write (SYSTEMIC chokepoint gap)** — `scopeNestedWrites` only scopes
   DMMF *relation* keys; a raw scalar FK in write `data` (`createPost`/`updatePost`
   `data:{ spaceId }`) is passed through untouched, so a member can attach a post to ANOTHER
   tenant's Space id → post stored `tenantId=A, spaceId=B` → `include:{space}` read-back leaks
   B's space (the scalar analog of the nested-`connect` IDOR the chokepoint blocks). Affects
   EVERY create/update with a user-controlled scalar FK to a tenant-scoped model. **FIXED**
   in `tenant-scope.ts`: `validateScalarFks` read-checks every scalar FK to a tenant-scoped
   target against the current tenant (via the base un-extended client) on create/update/upsert
   and throws on a foreign id; `createMany` (no per-row connect) fails closed. A rewrite-to-
   `connect` was rejected — Prisma's checked/unchecked input split would force rewriting EVERY
   FK incl. global `authorId`. The scalar-FK map is DMMF-derived (`<rel>Id` convention, since
   the runtime DMMF strips `relationFromFields`) and locked by `test/iso/scalar-fk.test.ts`
   (9 tests: foreign create/update/self-ref/createMany rejected; in-tenant + null allowed;
   global FKs stay scalar; map completeness + id-resolvability).
3. (none — the other 9 files verified clean across both skeptic passes.)

## Three defects the green build masks (tracked, NOT yet fixed)

1. **Workflow-context throw.** `socialAccounts.ts`, `slideRender.ts`,
   `slideGenerator.ts` were swapped to `getPrisma()` in an earlier batch, but the
   revdep scan shows they're reachable from `publish-post`/`slide-export`/
   `send-scheduled` — non-request paths where `getPrisma()` → `getTenantId()`
   **throws**. Confirmed: `publish-post.ts:130` calls `getAccountForPublishing()`
   → `getPrisma()` with no tenant in scope. Fix (Step 4/the workflow pass): wrap
   each workflow/cron entry body in `runWithTenant(tenantId, …)` (payload already
   needs to carry `tenantId`), or pass an explicit tenantId to these services.
   Latent only because workflows don't run in `wrangler dev` and this branch
   isn't deployed.
2. **Raw-SQL chokepoint bypass.** `comments.ts` (`listForPost`), `posts.ts`
   (`listFeed`/`getPost`/`listBookmarkedFeed`), and `community/members/page.tsx`
   read via raw `@/lib/db` with **no `tenantId` filter** — e.g. `SELECT … FROM
   Comment WHERE postId = ?`. The chokepoint can't see raw SQL. Fix: add an
   explicit `AND tenantId = ?` (from `getTenantId()`) or move the read to a scoped
   `getPrisma()` call; do `members` together with the User-membership join. These
   are on `PENDING_RAW_SQL_TENANT_AUDIT`; comments/posts were deliberately NOT
   half-migrated (their prisma writes + raw reads must land together).
3. **Request-context guarantee (systemic) — ✅ RESOLVED (interim) 2026-06-16.**
   `getPrisma()` → `getTenantId()` **throws** when no `x-tenant-id` is in scope.
   `src/middleware.ts` previously stamped it only on the tenant-route branch; the
   platform plane (apex host / reserved paths) returned without a tenant, so the
   feature routes still at the apex (`src/app/api/**`, pre-Step-2) resolved as
   "platform" → no tenant → every scoped `getPrisma()` caller (the 10 migrated
   2026-06-16 *and* the ~18 earlier) **threw**. **Fix:** the platform branch now
   stamps `HOME_TENANT` (`process.env.HOME_TENANT ?? NEXT_PUBLIC_REGION ?? "au"`)
   on the request headers (even on static routes) — the apex IS the deploy's
   home-region community during the AU/NZ transition, so this is the correct
   scope for home-tenant feature routes, not a leak (real tenant requests are
   caught by the slug/custom-domain branches first). **Kept fail-closed (NOT
   stamped):** `/api/cron/*` (iterates ALL tenants), `/api/webhooks/*` (tenant in
   the payload), `/mcp` + `/api/mcp` (tenant in the user token), `/internal/*`
   (slide render — tenant in the HMAC-signed URL). These determine their tenant
   from something other than the host, so they must throw (not silently scope to
   `au`) if a future `getPrisma()` there forgets to establish a tenant. **Still
   owed:** Step 2 (the real `/t/[tenant]` route move); the interim stamp is
   deleted then. **Verification:** the header-resolution half (`getTenantId()`
   returns a stamped `x-tenant-id` instead of throwing) is now unit-observed
   (`test/iso/tenant-context-header.test.ts`); the middleware→header propagation
   uses the same `NextResponse…({request:{headers}})` contract the tenant branch
   relies on. Full dev-server e2e (`/courses` renders vs 500) not yet run.

## Done + verified (the security-critical core)

| Module | What | Tests |
|---|---|---|
| `src/lib/tenant-models.ts` | fail-closed model→scope map (65 tenant / 15 global) | structural |
| `src/lib/tenant-scope.ts` | the `$extends` chokepoint, **recursive nested-write scoping** | 33 |
| `src/lib/tenant-context.ts` | ALS + `x-tenant-id` header, fail-closed `getTenantId()` | 5 |
| `src/lib/prisma.ts` | `getPrisma` / `getPlatformPrisma` / `withTenant` (+ kept default) | — |
| `src/lib/tenant-resolve.ts` | URL/host → tenant, reserved slugs, reject `/t/*` | 12 |
| `src/lib/services/tenants.ts` | `provisionTenant` (a tenant = one DB insert) | 6 |
| `prisma/schema.prisma` | 62 scoped + 5 registry; `tenantId @default("")` | — |
| `migrations/0021_tenant_isolation.sql` | table-rebuild + `tenantId='au'` backfill (verified on data) | — |

## The recipe (every fan-out change follows these — decided, don't re-litigate)

1. **Data access:** feature code calls `await getPrisma()` (scoped) — never the
   default `prisma` export, never `@/lib/db`, never `$queryRaw`. Reads/writes
   never pass `tenantId` (the chokepoint injects it; `@default("")` makes it
   optional in create types).
2. **Platform/registry/cross-tenant:** `getPlatformPrisma()` (explicit, reviewed).
3. **Global `User` limited to a tenant:** add the membership join explicitly —
   `where:{ tenantMemberships:{ some:{ tenantId } } }` (the chokepoint does NOT
   scope global models). Live leak today: `campaign-send.ts:700`.
4. **Non-request entry points** (cron, Workflows, queue consumers): wrap work in
   `runWithTenant(tenantId, …)`; the payload/message must carry `tenantId`.
5. **Role/permission:** the coarse role comes from the URL tenant's
   `UserTenant.role`, NEVER the global `User.role`. `getRolePermissions` does
   `getPrisma().role.findFirst({where:{name}})` (tenantId auto-injected; the
   `Role` PK is now `@@id([tenantId,name])`).
6. **No interactive `$transaction`** (`tx` doesn't inherit the extension) — array
   form only. Lint-ban it.

## Ordered remaining work

**Step 1 — middleware = root of trust (do FIRST, before any scoped route ships).**
Wire `src/middleware.ts` to: strip any inbound `x-tenant-id`; `parseTenantRequest(host, path)`; look the slug/custom-domain up via `getPlatformPrisma()` (cache ~30s); unknown→404, `suspended`→503; rewrite to `/t/<slug>/…` + set `x-tenant-id`; a `reject-direct-t` result →404. Until this lands, `getTenantId()` trusts a spoofable header.

**Step 2 — `/t/[tenant]` route restructure.** Move the 137 API routes + 79 pages under `app/t/[tenant]/`. Public marketing/platform routes stay at the apex (the `RESERVED_SLUGS`). Mechanical; the build is red until consistent.

**Step 3 — `region.ts` → `getTenantConfig()`.** Replace build-baked `REGION_CONFIGS`/`getRegionConfig()` (108 files, 285 refs) with a per-tenant `TenantSetting`-backed `getTenantConfig()` (async, reads the scoped/looked-up tenant). Parallelizable by file once the function exists. GA `gaId` moves here (§3 #32).

**Step 4 — auth/permissions.** ✅ PREREQUISITE DONE: the AU tenant bootstrap
(`bootstrapHomeTenant` + `POST /api/admin/tenant-bootstrap`, 2026-06-16) enrols
every existing user as a `UserTenant` member with their role preserved, so the
membership join + role-from-membership now have data to read (run it once per
deploy after 0021; slug is locked to `NEXT_PUBLIC_REGION`). Remaining:
`getCurrentUser` stays global-identity (User via `getPlatformPrisma`), but
membership/role resolve from `UserTenant` for the URL tenant; `getRolePermissions`
per recipe #5; MCP `getDbUser` asserts a `UserTenant` row for the URL tenant (§3
#12). The 6 deferred User-list pages + community member lists get the membership
join `where:{ tenantMemberships:{ some:{ tenantId } } }` here.

**Step 5 — surface hardening** (each per §3): storage key prefix `t/<slug>/` + read-auth; `unstable_cache`/`cache.ts` Map/`revalidateTag` keyed by tenant; slide-render signed-URL slug + R2 prefix; social `findMany` (now auto-scoped via the schema); Resend metadata `tenantId` + webhook resolve; notifications `tenantId`.

**Step 6 — migrate the remaining `@/lib/prisma` importers** off the default export to `getPrisma()`/`getPlatformPrisma()`/`runWithTenant()`. ✅ The `findUnique`-by-rescoped-unique callers are fixed (tsc green) and the default-export + raw-`@/lib/db` ratchets are **ON** (see "The two ratchets" above; 10 services migrated). Remaining work = drain `PENDING_TENANT_SCOPE` (the source-of-truth list, grouped by execution context) and `PENDING_RAW_SQL_TENANT_AUDIT`, **re-running the revdep scan before each service** so a workflow/cron-reachable file gets `runWithTenant`, not a throwing bare `getPrisma()`. Still TODO on the lockdown: ban `$queryRaw` and interactive `$transaction`.

**Step 7 — the rest of the §6 CI suite at the surface level** (storage prefix, cache bleed, MCP token, slide-render, egress) + the "no `tenantId=''`" data guard.

## Gotchas discovered (don't re-derive)

- **Nested `connect` was a real IDOR hole** — fixed by recursive scoping in the chokepoint. Any NEW write path is already covered, but raw SQL / `getPlatformPrisma` writes are not — review those.
- **3 single-field `@unique` exceptions** (`Poll.postId`, `EmailPreference.userId`, `EmailABTest.campaignId`) are 1:1-FK fields kept globally unique (IDOR-sound). The CI assertion allowlists them.
- **`tenantId = slug`** (immutable). Registry relations reference `Tenant.slug`.
- **Impact Lab (11 models) is GLOBAL** — self-contained event portal. Revisit only for per-tenant hackathons.
- **`EmailPreference` is currently 1:1-with-User (global-unique `userId`)** even though it carries `tenantId` — decide in Step 4 whether prefs are per-tenant (→ `User.emailPreferences` becomes `[]` + composite unique + caller fixes) or stay global-per-user.
- **The migration is table-rebuild + backfill** — safe for the existing AU data, but any NEW pre-tenant migration added before deploy must be re-snapshotted (`migrations/.last-schema.prisma`).
