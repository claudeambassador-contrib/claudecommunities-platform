# Tenant Isolation Specification — Option A (shared D1 + `tenantId`)

**Decision (2026-06-15): Option A is chosen. Paid Workers-for-Platforms is dropped.**
All tenants share one D1 database; every row of tenant-owned data carries a
`tenantId`; isolation is enforced **in application code** at a single chokepoint,
not by physical database separation.

This document is the authoritative, surface-by-surface contract for *what must be
true on every code path* so that no tenant can read or write another tenant's
data. It supersedes the W4P data-plane sections of `multi-tenancy-plan.md` and the
A/B fork in `multi-tenancy-implementation-scope.md`. Effort/phasing live in the
scope doc; this doc is about **correctness and completeness of isolation**.

---

## 0. Threat model — what we defend, and what we don't

**We defend against** (all are app-path leaks, the realistic risk surface):
cross-tenant read/write through any ORM call, IDOR by guessed/known row id,
cache bleed (response/data cache serving tenant A's bytes to tenant B), storage
key escape, auth confusion (a member of A treated as authenticated on B),
background jobs running without a tenant, and external callers (webhooks,
headless render) reaching the wrong tenant.

**We explicitly do not claim** protection against a full database-credential
compromise: anyone who can read the raw D1 sees all tenants. That is the accepted
cost of a shared database (vs. the dropped per-tenant-DB option). Mitigations:
least-privilege bindings, audited access, backups/Time-Travel, and — because the
chokepoint abstracts the data plane — the **option to migrate a single hot or
regulated tenant to its own D1 later without touching feature code**. If we ever
leave D1, Postgres Row-Level Security becomes available as a second enforcement
layer; today SQLite/D1 has no RLS, which is *why* enforcement lives in the app.

**The one principle everything below derives from:**

> Tenant is resolved **exactly once per request, from the URL/host**, before any
> data access. Every data path takes its scope from that single resolution.
> **Tenant scoping is independent of authentication** — an anonymous request to a
> public route is still scoped to its URL's tenant. "Public" never means
> "unscoped."

---

## 1. Root of trust — tenant resolution (`src/middleware.ts`, `src/lib/tenant-context.ts`)

Everything rests on resolving the *correct* tenant. If this is wrong, every
downstream scope is wrong. Required controls:

1. **Resolve from URL/host only.** Custom domain → registry lookup; otherwise
   first path segment `claudecommunities.com/<slug>` → registry. Resolution uses
   the **unscoped platform client** (`getPlatformPrisma()`), the only pre-tenant
   DB read, cached in-isolate ~30 s.
2. **Validate against the registry.** Unknown slug → 404. `status=suspended` →
   503. Reserved slugs (`admin`, `api`, `start`, `sign-in`, `t`, `_next`,
   `sitemap`, `robots`, `manifest`, `.well-known`, `merch`, `cities`,
   `community`, `events`, `courses`, `resources`, `speak`, `pricing`, `cowork`,
   `webinars`, `impact-lab`, …) can never be tenants.
3. **Rewrite to `/t/<slug>/…` + set an internal header**, and **strip any
   client-supplied tenant header on ingress** first. A client must not be able to
   forge `x-tenant-id`; middleware overwrites it unconditionally.
4. **Reject direct external requests to `/t/*`.** That path shape is *only*
   produced by middleware's internal rewrite. An external request whose path
   already starts with `/t/` → 404. (Otherwise a client could request
   `/t/<victim>/…` directly and bypass slug/host validation.)
5. **Never derive tenant from the Clerk JWT `org` claim.** Clerk sessions have one
   active organization at a time; two open community tabs flip it globally, so
   the token would authorize against the wrong tenant. The token proves *who*;
   the URL proves *which tenant*. (Plan §6.2.)

`getTenantContext()` reads the resolved slug lazily at first data-layer access
(via `headers()`/route param — an ALS scope entered in middleware does **not**
survive into render; see `src/lib/cf-env.ts`). It memoizes per `(ctx, tenant)`.

---

## 2. Data plane — the enforced Prisma chokepoint (`src/lib/prisma.ts`)

`getPrisma()` returns a `PrismaClient` wrapped with a `$extends` query extension
bound to the current `tenantId`. This is the single most correctness-critical
module in the system; it is small, centralized, and exhaustively tested.

**The extension's obligations, per operation shape** (this is where Option A
lives or dies):

| Operation | Required rewrite |
|---|---|
| `findMany` / `findFirst` / `count` / `aggregate` / `groupBy` | inject `where.tenantId = ctxTenant` |
| `findUnique` / `findUniqueOrThrow` | **rewrite to `findFirst`** with `tenantId` injected. `findUnique.where` only accepts unique fields, so `tenantId` cannot be added directly — this is the IDOR hole and the rewrite is mandatory. |
| `update` / `delete` / `upsert` *by unique selector* | **rewrite to `updateMany`/`deleteMany` with `tenantId` in `where` and assert `count===1`** (or `findFirst`-guard then act). A bare `update({where:{id}})` would otherwise mutate another tenant's row. |
| `create` | inject `data.tenantId = ctxTenant` |
| `createMany` | inject `tenantId` into every row |
| `updateMany` / `deleteMany` | inject `where.tenantId` |

> **⚙️ IMPLEMENTATION REALITY (built + verified 2026-06-15, supersedes the
> "rewrite" assumptions above).** Probed on Prisma 7.3 + driver adapter
> (`src/lib/tenant-scope.ts`, 33 isolation tests):
> - `findUnique`/`findUniqueOrThrow` — **NO findFirst rewrite needed.** Prisma 7
>   accepts a non-unique extra field in a `findUnique` `where` and **filters on
>   it at runtime** (returns null for a foreign-tenant row). Plain injection
>   closes the IDOR hole.
> - `update`/`delete` by unique selector — **NO updateMany/deleteMany rewrite
>   needed.** Injecting `tenantId` into the `where` makes a by-id write against a
>   foreign row **throw P2025** (record-not-found) and leave it intact.
> - `upsert` — native `upsert` with `tenantId` injected into both `where` and
>   `create` updates only the current tenant's row, else creates in the current
>   tenant. No manual updateMany-then-create.
> - The extension is implemented as a single `$allModels.$allOperations` switch
>   with a `default: throw` (fail-closed on any unhandled op).
> - **tenantId carries `@default("")`** so it is OPTIONAL in generated create
>   inputs (feature code never passes it; the chokepoint injects it, spread last
>   = spoof-safe). A missed injection orphans to `''` (invisible to every tenant
>   — not a leak); guard with a "no `tenantId=''` rows" check.

**Edge behaviors that must be handled, not assumed away:**

- **Nested writes — scoped RECURSIVELY, not just the top level (CORRECTION).**
  The original assumption ("extension acts on the top-level model only; a missing
  nested `tenantId` fails loudly") is **unsafe for nested `connect`**: a nested
  `connect`/`connectOrCreate` sets an FK by referencing an existing row's id — it
  inserts no row, so there is **no NOT-NULL net**, and it links across tenants
  (verified IDOR-via-connect: `post.update({data:{space:{connect:{id:<B>}}}})`
  re-parents A's post onto B's space, then `include` reads B's row). The
  chokepoint therefore **walks the write `data` tree** (`scopeNestedWrites` in
  `tenant-scope.ts`) and, for every tenant-scoped relation: injects `tenantId`
  into nested `connect`/`set`/`disconnect`/`delete` `where` (a foreign connect
  then throws — no match), into `connectOrCreate.where` + `create`, and stamps
  nested `create`/`createMany` rows. The model→relation→target map is built from
  `Prisma.dmmf` (fail-closed if absent). Locked by `test/iso/nested-connect.test.ts`.
- **Relation `include`/`select`:** included relations are fetched by Prisma's
  engine and are **not** independently re-filtered by the extension. Their
  isolation rests on **FK integrity** — which only holds because the write path
  above now prevents cross-tenant FKs (a nested `connect` can't reach a foreign
  row). Invariant: **relations never cross tenants.** Enforced by the recursive
  write-path scoping + a CI test that an `include` never returns a foreign child.
- **`findUnique` callers today:** `getCurrentUser` (`auth.ts:35`) does
  `user.findUnique({ where: { clerkId } })` — but `User` is a **global identity**
  table (no `tenantId`), so it correctly uses the **unscoped** client. The
  extension must therefore be applied **only to tenant-scoped models**; global
  models (`User`, suppression list, tokens) are exempt by an allowlist baked into
  the extension. Mis-listing a model is the failure mode → the model→scope map is
  a reviewed, tested artifact (§4).

**Companion clients:**
- `getPlatformPrisma()` — **unscoped**, for the registry/membership-resolution and
  the platform-admin plane only. Every call site is reviewed.
- `withTenant(slug, fn)` — audited escape hatch for the platform admin iterating
  tenants; memoized per `(ctx, slug)`; ESLint-restricted to platform modules.

**Raw-SQL lockdown (cheap here — the surface is almost empty):**
- The **3** `@/lib/db` raw callers (`src/app/community/members/page.tsx`,
  `src/lib/services/posts.ts`, `src/lib/services/comments.ts`) migrate to
  `getPrisma()` so they inherit the extension.
- Ban `$queryRaw`/`$executeRaw`/`$queryRawUnsafe`/`$executeRawUnsafe` via ESLint
  (only **1** internal use exists today, in `prisma.ts`). Any future raw SQL must
  go through a wrapper that appends `AND tenantId = ?`.

### 2.1 Escape hatches the extension does NOT cover (mandatory, from adversarial review)

The `$extends` query extension intercepts `model.method()` calls on tenant-scoped
models. Four things slip past it; each is a confirmed leak path in the current
code and must be handled explicitly.

1. **`$transaction` — the extension does not wrap it.**
   - *Array form* (`prisma.$transaction([a, b])`, e.g.
     `src/app/api/admin/email/automations/[id]/route.ts:52`): the operations are
     built before the transaction runs, but since they are still
     `model.method()` calls they DO carry the extension — **verify** this in the
     adapter; if the batch is constructed off the base client, the chokepoint
     must map each op and inject `tenantId` before dispatch.
   - *Interactive form* (`prisma.$transaction(async (tx) => tx.model.find…)`,
     e.g. `src/lib/services/impactLab.ts ~:180`): the `tx` handle is a **fresh
     client that does NOT inherit the extension** → `tx.model.*` hits unscoped
     D1. **Ban the interactive form via ESLint** (the D1 adapter doesn't truly
     support interactive transactions anyway — see the comment at
     `eventAgenda.ts:100`); array form is the only sanctioned multi-statement
     path. Locked by §6 tests 12–13.
2. **`upsert` / `connectOrCreate` (CORRECTED — built, not rewrite formulas).**
   - `upsert` — native `upsert` works: inject `tenantId` into `where` AND
     `create`. A foreign-id upsert then creates in the current tenant (never
     mutates the foreign row). No updateMany-then-create needed.
   - `connectOrCreate` — **the connect lookup is NOT auto-filtered by the
     extension** (the original claim here was false and was a live IDOR-via-connect
     hole). The chokepoint's recursive write-tree walk injects `tenantId` into the
     `connectOrCreate.where` (so a connect can only match a current-tenant row)
     **and** into the nested `create`. Same for a bare nested `connect`. See the
     "Nested writes" correction in §2.
3. **Fresh extension per `(ctx, tenant)` — never a baked-in cached client.**
   `getPrisma(tenantId)` MUST apply a fresh `$extends` bound to that `tenantId`
   on each call. The base D1 client may be ctx-cached
   (`src/lib/prisma.ts:30` `clientByCtx`), but the **scoped wrapper must never be
   shared across tenants** — otherwise a `withTenant(A)` then `withTenant(B)` in
   one request (platform-admin loop, cron drain) reuses A's scope for B. Locked
   by §6 test 1.
4. **Global-model queries the extension cannot scope — the most error-prone
   pattern.** The extension only filters *tenant-scoped* models. Any query over a
   **global** model (above all `User`) that must be limited to a tenant has to add
   the membership join **explicitly**:
   `where: { userTenants: { some: { tenantId } } }`. Two confirmed live leaks:
   - **Campaign recipients** (`src/workflows/campaign-send.ts:700`) do
     `user.findMany(segment)` with no membership filter → campaign A emails B's
     users. Must join `UserTenant`.
   - **Role-name resolution** (see §3 #5): the role *name* must come from the
     tenant `UserTenant` row, never the global `User.role`.
   Treat every `getPrisma().user.*` / `getPlatformPrisma().*` call as suspect in
   review.

---

## 3. Surface-by-surface isolation matrix

Every place tenant data flows. For each: how tenant is derived, the enforcement,
the failure mode if omitted, and the locking test. **Items 1–2 cover the bulk
(137 API routes / 79 pages) via the chokepoint; the rest are the paths the
chokepoint does *not* automatically cover.**

| # | Surface | Tenant derived from | Enforcement | If omitted | Test |
|---|---|---|---|---|---|
| 1 | SSR pages under `/t/[tenant]/**` (79) | rewrite path param | `getPrisma()` (scoped) | full cross-tenant read | render page for B asserts no A rows |
| 2 | API routes (137), **incl. public/unauth ones** (`/api/events`, `/api/impact-lab-interest`, `/cities`) | rewrite path param / header | `getPrisma()`; scoping ≠ auth | anon caller reads any tenant | anon GET tenant A returns no B data |
| 3 | IDOR via `findUnique`/`update`/`delete` by id | n/a | extension rewrite (§2) | read/mutate row by guessed id | by-id fetch of B's row → null |
| 4 | Auth `getCurrentUser` (`auth.ts`) | URL tenant | global identity **+** `UserTenant` membership check against URL tenant; non-member → anonymous/403 | member of A treated as authed on B | A-member request to B → unauthenticated |
| 5 | Permissions / `<Can>` / `getRolePermissions` (`auth.ts:148,158`, `permissions.ts:141`, `mcp/route.ts:66`) | URL tenant | `Role` becomes `@@id([tenantId,name])`; **the role *name* MUST come from the URL-tenant `UserTenant.role`, NEVER the global `User.role`** (else admin-in-A = admin-in-B); MCP `isAdmin` derives from the membership row | **cross-tenant privilege escalation** via role-name collision | admin-in-A / member-in-B resolves only member perms in B |
| 6 | Storage **write** (`/api/upload`, `/upload/mcp`, `storage.ts:146`) | URL tenant | derive key prefix `t/<slug>/` server-side; client `folder` is a **sanitized sub-path only** (fixes attacker-controlled `upload/route.ts:31`) | write into another tenant's prefix | upload as A cannot target `t/B/` |
| 7 | Storage **read** (`/api/files/[...key]`) | URL tenant | key's `t/<slug>/` prefix **must equal** request tenant (not just block traversal) | read any object by key | A request for `t/B/…` → 403 |
| 8 | Full-route / data cache (ISR) | rewrite path | pages cache under `/t/<slug>` path (already keyed); audit any shared `fetch()` cache | stale/foreign page served | two tenants' same route cached separately |
| 9 | `unstable_cache` (`community/page.tsx`, `revalidate.ts`) **and the in-memory `Map` in `src/lib/cache.ts:9,50`** (`profile:<userId>`, `userPosts:<userId>`) | URL tenant | **tenant in every cache key** — `unstable_cache` `keyParts` (esp. the untagged `getSpaces`/`getMemberStats`/`getOnlineMembers`/`getTopContributors`) AND the module-global `Map` keys (persist across requests in an isolate) | one tenant serves another's cached spaces/members/profile | every cached fn keyed by tenant; A≠B values |
| 10 | Cache tags / `revalidateTag` (8 files) | URL tenant | tags become `tenant:<slug>:<name>` via `tenantTag()` | A's revalidate busts B's cache | A revalidate leaves B cache intact |
| 11 | DO ISR revalidation (`NEXT_CACHE_DO_QUEUE`/`DOQueueHandler`) | cache-key slug | re-render runs in `runWithTenant`; tenant in cache key | out-of-scope re-render → wrong/no tenant | DO re-render targets correct tenant |
| 12 | MCP (`/t/<slug>/api/mcp`, `src/lib/mcp/tools.ts`) | URL tenant | `getDbUser` asserts the token's user **has a `UserTenant` row for the URL tenant**; reject otherwise | any token reaches any tenant's MCP | A's token to B's MCP → 403 |
| 13 | Cron `scheduled()` (`src/worker-scheduled.ts`) | enumerated | list `live` tenants; process each in `runWithTenant(tenantId)` | job reads/writes wrong/no tenant | scheduled drain scoped per tenant |
| 14 | Queue consumers (`tenant-jobs`, notifications) | message `tenantId` | payload carries `tenantId`; `runWithTenant` | consumer mixes tenants | message handler scoped to payload tenant |
| 15 | Workflows (`slide-export`, `publish-post`, `campaign-send`) | payload `tenantId` | every step enters `runWithTenant`; payload carries `tenantId` | publish/email as wrong tenant | workflow step reads only its tenant |
| 16 | Notifications queue (`NOTIFICATIONS` → external `cloudflare-build-notifications`; `notify.ts:20`) | message body | add `tenantId: string` to `NotificationMessage`; inject at every `publishNotification()` site; external consumer MUST reject messages missing `tenantId` and route per tenant (cross-repo contract) | NZ-style dropped/misrouted notes | tagged message routes to right channel |
| 17 | Email send (Resend, `src/lib/resend.ts`, `campaign-send.ts:475`) | URL/job tenant | per-tenant from-address/sending domain; **stamp `tenantId` into Resend metadata/custom-headers on every send** (this is what #18's webhook resolves from — close the loop); suppression list is **global identity** (a person's unsubscribe is platform-wide) | send as wrong community; webhook can't attribute events | each Resend message carries `tenantId` |
| 18 | Resend **webhook** (`/api/webhooks/resend`) | tagged metadata | event has **no URL tenant**; resolve tenant from metadata tagged at send time | event applied to wrong tenant | webhook updates only tagged tenant |
| 19 | Clerk webhook | event payload | **global identity** event → platform plane; fan out to the user's memberships | identity desync | user.updated reflected across memberships |
| 20 | Slide render (puppeteer, `slideRender.ts:254,307`, `slideRenderSign.ts:59`, render route `/internal/slide-render/…`) | signed URL | (a) add slug to the **HMAC payload** `eventId\|slideId\|speakerId\|refWidth\|slug\|exp` and to the URL path; render route resolves tenant **from the verified-signed path only**; (b) **tenant-prefix the R2 key** `t/<slug>/slides/render/<hash>.png` (today it's an unprefixed content-addressed `slides/render/<hash>.png` at `:254` — two tenants with the same fingerprint **share one object**, and `isR2KeyStillReferenced` (`:359`) is tenant-scoped, so A's re-render concludes "orphan" and **deletes the PNG B still uses**); (c) the `*Internal` data helpers (`slideGenerator.ts:76`, `speakers.ts:97`) must take explicit `tenantId` from the verified URL, not the unscoped default client | render reads/deletes another tenant's slides | re-render by A never deletes/serves B's object; signed URL bound to tenant |
| 21 | Sitemap / `robots.ts` / `manifest.ts` / OG | URL/host tenant | generated from the tenant's own config + content; never list another tenant's URLs | leak another tenant's URLs/content | sitemap for A lists only A |
| 22 | `.well-known` oauth/mcp discovery (`oauth-protected-resource/mcp/route.ts:25`) | URL/host | per-tenant resource metadata under `/t/<slug>` + apex platform discovery; **responses must be `private` (or `Vary: Host, X-Forwarded-Host` + a host-varying edge rule)** — today it's `public, max-age=3600` with a host-derived issuer, so the edge serves the first host's issuer to the next | wrong issuer/resource cross-served via edge cache | discovery issuer matches requesting host |
| 23 | Rate limiting (`rate-limit.ts`, 31 sites) | URL tenant | limit keys include `tenantId` | A exhausts B's quota | A's bursts don't throttle B |
| 24 | Search / leaderboard / counts / aggregates | URL tenant | go through scoped client (extension covers `count`/`aggregate`/`groupBy`) | counts/leaderboard mix tenants | leaderboard for A excludes B users |
| 25 | User-scoped data (`Activity`, `Notification`, `Connection`, `EmailPreference`) | URL tenant | gain `tenantId`; per-tenant (a user's activity in A ≠ B) | feed/notifications bleed across tenants | A's feed shows only A activity |
| 26 | Audit log | URL/job tenant | every entry stamped `tenantId` | unattributable actions | audit query scoped per tenant |
| 27 | Platform admin plane (apex `/admin`) | n/a (cross-tenant) | `getPlatformPrisma()`/`withTenant`; gated by `publicMetadata.platformRole`; audited | privilege escalation to all tenants | non-platform user → 403 at apex /admin |
| 28 | Link-preview / outbound `fetch` (`/api/link-preview`) | URL tenant | scope the rate-limit/cache key; ensure **no tenant data in outbound request** (adjacent SSRF concern, keep existing host allowlist) | tenant data egress / SSRF | outbound carries no tenant secret |
| 29 | Logs / observability | URL/job tenant | tag log lines with `tenantId` (forensics, not a gate) | can't trace a leak | logs filterable per tenant |
| 30 | AU/NZ data migration (§4 of plan) | n/a | **backfill `tenantId`** on every tenant-scoped row when seeding AU/NZ tenants | unlabeled legacy rows visible to all | post-migration: zero `tenantId IS NULL` rows |
| 31 | Synthetic Cache-API keys (`caches.default`, `/api/admin/users/names:8`) | URL tenant | embed tenant slug in the synthetic key; admin/user responses are `private` (never `public`) | in-worker cache serves A's user list to B | A's cached list never served to B |
| 32 | Third-party analytics egress — GA `gaId` (`layout.tsx:100`) | URL tenant | `gaId` moves from `region.ts` to per-tenant `TenantSetting`; render via `getTenantConfig()`, omit script when null; **no analytics/telemetry id may be region/build-baked** | all tenants' pageviews land in one GA property | two tenants emit to distinct (or no) GA property |
| 33 | Social accounts/posts (`socialAccounts.ts:274`, `socialPosts.ts:198`) | URL tenant | `SocialAccount`/`SocialPost` gain `tenantId` (see §4) so existing unfiltered `findMany` inherits the scope; per-tenant OAuth tokens | A could list/post-as B's connected accounts | A's accounts hidden from B |
| 34 | Campaign recipient/segment query over global `User` (`campaign-send.ts:700`) | job tenant | global `User` is NOT auto-scoped — segment query MUST join membership `where:{ userTenants:{ some:{ tenantId } } }` (see §2.1 #4) | campaign A emails B's users | A's recipient set excludes B-only users |
| 35 | Storage write `folder` sanitization (`upload/route.ts:7,31`) | URL tenant | `folder` must match `^[A-Za-z0-9/_-]+$`, reject `..`/leading `/`; key = `t/<slug>/<folder>/<file>` built server-side; legacy unprefixed keys → **403 fail-closed** on read until the Phase-4 R2 copy/alias migration | path escape into another prefix | malformed/foreign `folder` rejected |

---

## 4. Schema changes required for isolation (Option A)

**New models** (registry/membership live in the platform scope, read via
`getPlatformPrisma()`):
- `Tenant` — registry (slug, customDomain, status, settings pointer).
- `TenantSetting` — admin-editable config (replaces `REGION_CONFIGS`).
- `UserTenant` — **membership join** (`userId`, `tenantId`, **`role`** = coarse
  owner/admin/member). `User` cannot carry `tenantId` (a person can belong to many
  communities), and **the per-tenant `role` lives HERE, not on the global
  `User.role`** — otherwise being `admin` in one community makes you `admin` in
  all (§3 #5, the privesc leak). `User.role` is deprecated/flattened. The
  membership check (§3 #4, #12) is
  `getPrisma().userTenant.findFirst({where:{userId}})` — `tenantId` auto-injects to
  the URL tenant, so it returns a row (with that tenant's `role`) **iff** the user
  belongs to *this* tenant. Elegant and correct by construction.
- `PendingAdminGrant` — invitees with no account yet (lowercase-email matched).
- `AuditLog` — `tenantId`-stamped.

**Per-tenant column work** (the bulk, now **required** under A):
- Add `tenantId` to the ~38 tenant-scoped models; **expand-contract** migration
  (add nullable → backfill → set `NOT NULL`). Existing rows are AU's → backfill
  `tenantId='au'`.
- **Composite indexes**, never bare `@@index([tenantId])`: mirror each of the 28
  existing indexes with `tenantId` prepended (`[tenantId, spaceId]`,
  `[tenantId, status, nextActionAt]`, …) — every hot query filters by tenant
  **plus** an existing key.
- **Rescope tenant-scoped `@unique` → `@@unique([tenantId, …])`** (the 27-field
  audit). Tenant-scoped (rescope): `Space.slug`, `Event.slug`, `Role.name`
  (also the PK reshape), `MembershipTier.name`/`.slug`, `Course.slug`, badge
  names, content slugs — two communities must each be able to have a `#general`
  space and a `member` role. **Global-identity (leave alone):** `User.clerkId`,
  `User.email`, suppression-list email, unsubscribe/verification tokens.
- `Role` PK `@id(name)` → `@@id([tenantId, name])` — the largest single migration
  (reshapes what `getRolePermissions()` joins on).

- **`SocialAccount` / `SocialPost` are tenant-scoped** (the adversarial review
  found them missing from the model list and the services do unfiltered
  `findMany` — `socialAccounts.ts:274`, `socialPosts.ts:198`). Add `tenantId` +
  `@@unique([tenantId, connector, externalId])`; once scoped, the existing
  queries inherit the filter.
- **Assertion (CI): every tenant-scoped model's `@id`/`@@unique`/`@@id` includes
  `tenantId`.** This is what makes the `findUnique`→`findFirst` rewrite (§2)
  sound — the injected `tenantId` plus the supplied unique field must together
  identify ≤1 row. A tenant-scoped model whose unique selector omits `tenantId`
  is a build failure.

**Model→scope map** is a single reviewed artifact (tenant-scoped vs. global)
that the `$extends` allowlist and the migrations both consume. A model is
**tenant-scoped** if its rows belong to one community (Space, Post, Comment,
Event, Course, Role, `SocialAccount`, `SocialPost`, campaigns, Activity,
Notification); **global** if it keys on a person's platform identity or a
platform-wide artifact (`User`, suppression list, tokens, and the
`Tenant`/`UserTenant` registry themselves). **Mis-listing a model is the headline
failure mode** — a tenant-scoped model marked global is silently unscoped; a
global model marked tenant-scoped breaks identity lookups. The map is reviewed
and tested.

---

## 5. Defense in depth

Option A's isolation is only as strong as the chokepoint, so it is backstopped:

1. **The extension is tiny and central** — one module, one place to review/test.
2. **Raw SQL banned** — the bypass surface is ~empty (1+3 files), so the ban is
   real, not aspirational.
3. **ESLint lockdown** — `env.DB` reachable only inside `prisma.ts`;
   `getPlatformPrisma`/`withTenant` reachable only inside platform modules;
   feature code must call `getPrisma()`.
4. **The CI isolation suite (§6) runs forever** — the invariants can't silently
   regress.
5. **Single-tenant escape valve** — because the data plane is abstracted, a
   regulated/high-value tenant can later be moved to its own D1 behind the same
   `getPrisma()` without feature-code changes.

---

## 6. CI isolation test suite (the invariants, locked permanently)

These are not one-time checks; they encode the isolation contract and run on
every PR. A failure is a release blocker.

1. **Multi-tenant-in-one-request** — within one request the client is never
   reused across tenants (the platform `withTenant` loop gets a fresh scoped
   client per tenant).
2. **IDOR** — `findUnique`/`update`/`delete` by another tenant's row id returns
   `null`/throws/`count===0`, never the row.
3. **Cross-tab org claim** — a Clerk session whose active org is tenant B, on a
   tenant-A URL, authorizes as A (URL wins) and membership is checked against A.
4. **Public-route scoping** — an anonymous request to tenant A's public API never
   returns tenant B data (scoping ≠ auth).
5. **Storage read/write prefix** — write can't target another prefix; read of
   `t/<other>/…` → 403.
6. **MCP cross-tenant token** — a valid token for a user not in the URL tenant →
   rejected.
7. **Cache-key bleed** — two tenants hitting the same `unstable_cache` fn get
   distinct values; A's `revalidateTag` leaves B intact.
8. **Nested-write tenancy** — a nested create without `tenantId` throws (loud
   failure, not a silent foreign write).
9. **Relation include** — an `include`/`select` never returns a foreign-tenant
   child.
10. **Raw-SQL ban** — lint fails on any `$queryRaw*`/`$executeRaw*` or new
    `@/lib/db` import outside the wrapper.
11. **No null tenantId** — post-migration assertion: zero `tenantId IS NULL` in
    any tenant-scoped table.
12. **`$transaction` array scoping** — a `$transaction([...])` creating+reading
    across tenant models returns no foreign-tenant rows.
13. **Interactive-`$transaction` ban** — lint asserts zero
    `prisma.$transaction(async` in feature code.
14. **Role from membership** — a user who is `admin` in A and `member` in B
    resolves only `member` permissions on a B URL (no privesc via role-name).
15. **Global-model membership join** — the campaign recipient/segment query
    excludes users with no `UserTenant` row for the dispatching tenant.
16. **Social isolation** — A's `SocialAccount`/`SocialPost` never appear in B's
    listings.
17. **Slide-render no cross-delete** — A re-rendering an identical-fingerprint
    slide never deletes or serves B's R2 object; a signed URL for A's render is
    rejected on a B path.
18. **`upsert`/`connectOrCreate` by foreign id** — creates a new row rather than
    mutating/connecting the foreign-tenant row.
19. **Third-party egress keyed per tenant** — two tenants render distinct (or
    absent) GA ids; no analytics id is region/build-baked.

---

## 7. What changes vs. the W4P plan (delta)

Dropping W4P **removes** large pieces and **promotes** others to required:

**Removed entirely:** the per-tenant data-worker template + its lifecycle, the
dispatch namespace, the session-multiplexed transport (the `spike/phase0/` work
is now moot for the data plane — keep it only as the documented escape-hatch
proof), the 32-invocation transport problem, migrate-across-N-DBs fan-out, and
the W4P subscription cost.

**Massively simplified — provisioning is now a DB insert.** Creating a tenant =
insert `Tenant` + seed `TenantSetting`/system `Role`s + create the Clerk org +
write the owner's `UserTenant`. **No D1 creation, no worker upload, no async
provisioning workflow, no health-check loop — the tenant is live the instant the
rows commit.** The separate non-routable provisioning worker (which existed to
hold the Cloudflare API token) is **not needed**; provisioning is an in-process
service call. This is the single biggest upside of Option A.

**Promoted to required** (were "A-only" in the scope): the ~38-model `tenantId`
+ composite-index + `@@unique([tenantId,…])` migrations, the `Role` PK reshape,
and the `$extends` chokepoint + IDOR rewrite as the Phase-1 keystone gate.

**Unchanged:** the `/t/[tenant]` restructure, the `region.ts → getTenantConfig()`
migration (108 files), custom domains via Cloudflare for SaaS (Phase 3), Clerk
one-app-+-orgs identity, and the AU/NZ migration (now a `tenantId` backfill
instead of export/import to separate DBs).

**Revised Phase 0** (no W4P spike): the go/no-go gate becomes *the chokepoint
itself* — build `$extends` tenant scoping + the IDOR rewrite + the CI isolation
suite (§6) against a two-tenant seed, and prove a battery of cross-tenant
attempts all fail, before the `/t/[tenant]` restructure begins.
