# Full Multi-Tenancy: Implementation Plan

> **DECISION (2026-06-15) — data plane: Option A (shared D1 + `tenantId`), paid
> Workers-for-Platforms DROPPED.** The per-tenant-data-worker / dispatch-namespace
> design below (§3–4, §13) is **superseded**: tenants now share one D1 and
> isolation is enforced in application code at a single chokepoint. The
> authoritative isolation contract is **`docs/multi-tenancy-isolation-spec.md`**;
> the code-grounded work breakdown is `docs/multi-tenancy-implementation-scope.md`.
> The W4P sections here are retained for rationale/history only. Net effect:
> provisioning becomes a DB insert (no D1 creation, no worker upload, no
> provisioning worker), the 32-invocation transport problem disappears, and the
> `spike/phase0/` transport work is kept only as the documented future
> escape-hatch (moving a single hot/regulated tenant to its own D1).

Status: **v6 — adversarially reviewed, three rounds.** Round 1 reviewed the
deployment-per-tenant design (v2, superseded when requirements changed);
round 2 reviewed the SaaS design and reshaped identity/credentials; round 3
reviewed the per-tenant data-worker data plane and surfaced the
32-invocation limit that now shapes the transport (§4.1). All blockers and
majors are incorporated (⚠ marks where review changed the design).

Target product shape: **Circle/Skool for Claude communities.** Tenants live at
`claudecommunities.com/<tenant>` (e.g. `/india`), can bring their own domain
(`swissclaudecommunity.ch`, `thaiclaudecommunity.com`), sign up themselves,
get approved by the platform, configure their community, and go live —
minutes, not deploys.

---

## 1. Requirements

1. **Path-based tenants** under one apex: `claudecommunities.com/<slug>`.
2. **BYO custom domains** mapping onto the same tenant (path and domain can
   coexist; the custom domain becomes canonical when present).
3. **Separate database per tenant**, plus one platform database for the
   top-level admin.
4. **Self-serve lifecycle**: sign up → platform approval → tenant admin
   configures → live. No code changes, no deploys, no vendor dashboards per
   tenant.
5. **Platform admin**: approve/onboard tenants, define tenant admins,
   suspend/resume, fleet overview.
6. **Tenant admins configure their community** themselves (branding, links,
   images, cities, features).

## 2. Verified platform facts (load-bearing)

- **D1 is built for DB-per-tenant.** 10 GB per database; database count per
  account raisable into the millions on paid plans
  ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/)).
- **Workers for Platforms (W4P) dispatch namespaces**: one static
  `dispatch_namespace` binding, then `env.TENANTS.get(name)` resolves a
  namespaced worker **by name at runtime**. Unlimited workers per namespace
  (no per-account script limits); namespaced workers can carry D1/KV/R2
  bindings; per-call custom limits (CPU, subrequests); namespaced workers
  are **not publicly routable**.
  ([how it works](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/),
  [dynamic dispatch](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/dynamic-dispatch/))
- ⚠ **W4P billing meters** (corrected in round 3): the dispatch chain bills
  as **one inbound request**; subrequests between your workers are not
  billed per-call — the real meters are inbound requests, **CPU-ms**
  (~$0.02/M ms past the included 60M), and **scripts: 1,000 included, then
  ~$0.02/script/mo** — i.e. "unlimited workers" is true but not free past
  1,000 tenants. Base plan $25/mo.
  ([W4P pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/))
- ⚠ **A request chain allows at most 32 Worker invocations**, and every
  call on a service/dispatch binding counts; further calls throw
  ([service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)).
  This rules out one-dispatch-per-query (§4.1). Also: ~6 simultaneous
  outbound connections per invocation — parallel query fan-outs serialize
  beyond that.
- **Worker-to-worker calls are near-zero latency** (typically same-thread).
  W4P has a documented `wrangler dev` local-development story
  ([local dev](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/developing-with-wrangler/)).
- **Clerk**: one application + **Organizations** is Clerk's multi-tenant
  model (shared user pool, org memberships). Org **roles are
  application-global**, not per-org — custom per-tenant roles cannot live
  in Clerk (§6). Isolated per-tenant user pools ("Clerk for Platforms")
  does not exist yet. Custom-domain auth uses **satellite domains** (paid,
  per-domain DNS + config).
  ([orgs](https://clerk.com/docs/guides/organizations/overview),
  [satellite domains](https://clerk.com/docs/advanced-usage/satellite-domains),
  [pricing](https://clerk.com/pricing))
- **Cloudflare for SaaS (Custom Hostnames)** attaches third-party domains
  with managed certs; requires a fallback-origin / `*/*` zone-route setup —
  the current `custom_domain: true` routes (`wrangler.jsonc:18-27`) do not
  cover custom hostnames; orange-to-orange has CNAME-flattening caveats.
  Both are Phase 3 work items.

## 3. Architecture: single app + per-tenant data workers

### Why deployment-per-tenant (v2) is out

v2 (one full Worker + D1 + Clerk app per tenant, industrialized) was right
for operator-onboarded, few-tenant hard isolation. The SaaS requirements
kill it: path tenants on one apex want one app; "signed up → live in
minutes" is incompatible with a CI build + Clerk app + DNS runbook per
tenant; the Skool UX (one account, many communities) wants a shared user
pool.

### Why direct-bindings-on-the-serving-worker (v4) is the fallback, not the default

v4 attached every tenant's D1 to the serving worker via the settings-PATCH
API. Review left it standing but wounded: a read-modify-write that must
never drop Worker secrets (KEK-wipe risk), a deploy/PATCH reconciliation
race, new bindings invisible to running isolates, and an unofficial
~5,000-binding ceiling. The per-tenant data worker design eliminates all
four structurally — at the price of a network-shaped transport to the DB
(§4.1). v4 remains the documented fallback if the Phase 0 spike fails the
transport (§13).

### The shape

```
            claudecommunities.com (zone, platform account)
            + custom hostnames via Cloudflare for SaaS
                             │
             ┌───────────────▼────────────────┐
             │   SERVING worker (Next.js app)  │
             │   — zero Cloudflare API creds — │
             │   — STATIC config, forever —    │
             │                                 │
             │  middleware: resolve tenant     │
             │   /india/* ──────────► india    │
             │   swissclaude…ch/* ──► swiss    │
             │   apex /, /start, /admin ► platform surfaces
             │                                 │
             │  bindings: PLATFORM_DB (D1),    │
             │   STORAGE (R2, tenant prefixes),│
             │   TENANTS (dispatch namespace), │
             │   TENANT_JOBS queue (producer), │
             │   PROVISION queue (send-only)   │
             └──────┬──────────────────────────┘
                    │ ONE dispatch per request: session to t-<slug>,
                    │ all queries pipelined inside it (§4.1)
             ┌──────▼──────────────────────────┐
             │ DISPATCH NAMESPACE "tenants"     │
             │  t-au    ── D1 cc-t-au           │   one small "data worker"
             │  t-nz    ── D1 cc-t-nz           │   per tenant: same template
             │  t-india ── D1 cc-t-india        │   script, only the D1 binding
             │  …unlimited…                     │   differs; NOT publicly routable
             └──────────────────────────────────┘
                    ▲ uploads scripts / creates D1s
             ┌──────┴──────────────────────────┐
             │ PROVISIONING worker (separate,   │
             │ non-routable)                    │
             │  holds the Cloudflare API token  │
             │  + Clerk admin ops; runs the     │
             │  TENANT_PROVISION workflow       │
             └──────────────────────────────────┘
              one Clerk app: shared users,
              one Organization per tenant
```

- **Credential separation is structural**: the serving worker holds no
  Cloudflare API token. Creating D1 databases and uploading data workers
  happens in the provisioning worker, reachable only via a queue carrying
  `{tenantId, action}`.
- **Data workers are not publicly routable** — reachable only through a
  `dispatch_namespace` binding; no routes, no URLs, no per-call auth to
  design. (The "public URL/route per data worker" variant was rejected:
  public attack surface per tenant, an auth envelope on every call, and
  per-tenant route management, for no benefit over the namespace.)

### Isolation model, stated honestly

- Every request resolves exactly one tenant at a single **chokepoint**;
  everything below it gets its DB/storage from context (§4.2). The serving
  worker picks *which data worker name* to open a session to — that
  selection is the security boundary. The *separate database* property is
  intact and slightly stronger than direct bindings: each tenant's D1 is
  attached to its own worker, reachable only through the named dispatch
  hop, which can also carry per-tenant CPU/subrequest limits (free QoS
  lever).
- **Blast radius**: one bad serving-worker deploy affects all tenants →
  gradual deployments + staging fleet (§9.4). The data-worker template is
  versioned and rolled out independently (§4.4), canary-first.
- **Scale ceiling**: none that matters — unlimited namespace workers
  (~$0.02/script/mo past 1,000); D1 count raisable to millions.

### Trade-offs vs v4 direct bindings

| | v4 direct bindings | v6 data workers |
|---|---|---|
| Tenant ceiling | ~5,000 (unofficial) | unbounded (per-script fee past 1,000) |
| Serving-worker config | mutated per tenant (PATCH hazards) | static forever |
| New-tenant visibility | next isolates only | immediate (`get()` by name) |
| DB access | native binding calls | one dispatch session per request + framed queries (§4.1) |
| Extra moving part | — | data-worker template lifecycle + fan-out |
| Extra cost | — | W4P $25/mo + CPU-ms + per-script past 1,000 |
| Per-tenant QoS | no | yes (custom limits per dispatch) |

### Trade-offs vs v2 (unchanged)

| v2 (stamp) | v6 (SaaS) |
|---|---|
| Per-tenant Clerk app & keys | One Clerk app; orgs for membership. Users are platform-level. |
| Per-tenant Worker secrets | Platform keys by default; tenant BYO keys encrypted in tenant DB (§8) |
| Infra-enforced isolation | Code-chokepoint isolation over per-tenant DBs |
| Onboarding in hours | Onboarding in minutes |

A future flagship tenant demanding hard isolation can still get a dedicated
v2-style stamp; the config-as-data work here is its prerequisite anyway.

## 4. Data layer: DB-per-tenant via data workers

### 4.1 The transport: one session per request, queries as frames ⚠

The naive design — one dispatch `fetch()` per query — is **not viable**: a
request chain caps at **32 Worker invocations** and a single page render
here already issues ~16 queries (`src/lib/prisma.ts` documents it), with
heavy admin pages exceeding the cap outright. Prisma controls query
issuance, so the app cannot coalesce them. Therefore:

- The remote-D1 client opens **one session per request** to `t-<slug>`
  (WebSocket upgrade over the dispatch fetch — 1 invocation total — or an
  RPC session stub if the spike confirms stub method calls don't count as
  separate invocations) and **pipelines every query as a correlated
  frame**: `{id, sql, params, method: all|run|first|raw}` →
  `{id, results, meta}`.
- **Fidelity contract** (⚠ round-3 finding — Prisma's error mapping parses
  SQLite message text): the data worker relays D1 results, `meta`
  (`last_row_id`, `changes`, `rows_read/written`), and **error messages +
  codes verbatim** — never re-wrapped — so `P2002` unique-constraint
  handling (`src/lib/auth.ts:110`, `impactLab.ts`) keeps working. Params
  and results use a typed envelope (base64-tagged blobs for the schema's
  `Bytes` columns). `batch()` maps to one frame preserving ordering and
  per-statement error attribution (what PrismaD1 `$transaction` relies on).
- The session amortizes the hop: frames over an established same-thread
  channel are sub-millisecond-class; the ~6-simultaneous-connection limit
  doesn't bite because all queries share one connection.
- The data worker stays a **dumb pipe** (~100 lines, one template, only the
  D1 binding differs): session endpoint + `GET /health` (returns the
  applied migration state from `d1_migrations`). No business logic, ever.

### 4.2 Request-scoped access (the chokepoint) ⚠

Round-3 correction: an AsyncLocalStorage scope entered **in Next.js
middleware does not survive into the render** (middleware is a separate
invocation phase — the repo's `src/lib/cf-env.ts` ALS bridge exists for
exactly this reason). The chokepoint therefore derives tenant lazily:

- Middleware resolves the tenant and **encodes it in the rewrite**
  (`/t/<slug>/…`) plus an internal header.
- `getTenantContext()` (new, `src/lib/tenant-context.ts`) reads it at the
  data layer via `headers()`/route params on first access per request;
  `getPrisma()` → `new PrismaD1(remoteD1(slug))` — PrismaD1 reused
  unchanged, only the `D1Database` implementation is swapped.
  `src/lib/db.ts` raw helpers ride the same client.
- **Non-HTTP entry points use the same API explicitly**: workflow steps,
  queue consumers, and `scheduled()` call `runWithTenant(payload.tenantId,
  …)` — there is no middleware there, and the plan does not pretend
  otherwise.
- Client memoization is per `(ctx, tenant)` — never per-ctx alone (a
  platform request iterating tenants via the audited `withTenant` escape
  hatch must not reuse the first tenant's session). CI carries a
  multi-tenant-in-one-request regression test.
- eslint lockdown: no `env.TENANTS` access outside the chokepoint modules.
- `getPlatformPrisma()` (direct `PLATFORM_DB` binding) stays explicit and
  separate.

### 4.3 Tenant creation (provisioning workflow — in the provisioning worker)

On approval, the serving worker enqueues `{tenantId, action: "provision"}`;
the provisioning worker's `TENANT_PROVISION` workflow runs:

1. Create the D1 database via API; record id in registry
   (`status=provisioning`).
2. Upload the data worker: `PUT` the current template into the `tenants`
   namespace as `t-<slug>` with its `DB` binding → record
   `dataWorkerVersion`.
3. Apply migrations **through the data worker** (the provisioning worker
   has its own namespace binding). ⚠ Mechanics (round 3): migration files
   are split into statements with the same parser wrangler uses, applied
   via one `batch` frame per migration with per-statement error capture;
   **the tenant DB's `d1_migrations` table is the truth**, the registry's
   `migrationTag` is a cache reconciled from `/health`. Long backfills are
   chunked with progress rows (a single dispatch has a bounded CPU budget).
4. Seed: system roles, `TenantSetting` defaults (seed-if-absent), starter
   cities.
5. Create the Clerk Organization; make the requesting user its owner; write
   the tenant-DB `User` row + role (lowercase-normalized email).
6. Health-check: dispatch `GET /health` (immediate — `get()` resolves by
   name, no isolate lag), then an HTTP smoke test of the tenant URL through
   the serving worker.
7. Mark `live`; notify the applicant.

No mutation of the serving worker, ever.

### 4.4 Data-worker template lifecycle

The template lives in-repo (`workers/tenant-data/`), versioned. Changes
(rare) fan out as per-tenant re-uploads via API — no builds — canary-first
(internal tenants → fleet), recording `dataWorkerVersion` per tenant.
⚠ Fan-out runs under the global API rate limit (~1,200 req/5 min): a
10k-tenant fleet rollout takes ~45 min — acceptable, stated. The spike
asserts in-flight queries survive a tenant's re-upload (expected seamless).
CI diffs registry vs namespace listing (paginated) for drift; a
`repair <slug>` action re-uploads one tenant.

### 4.5 Migrations across N tenant DBs

- Pipeline applies migrations tenant-by-tenant through the data workers
  (mechanics per §4.3.3) → reconciles `migrationTag` → only then ships
  serving-worker code that requires it (version gate). Per-tenant failure
  flags that tenant `maintenance` + alert, not a fleet block.
- Expand-contract migrations are mandatory (code vN runs on schema vN-1
  during rollout).
- Rollback: D1 Time Travel per tenant + redeploy previous sha;
  roll-forward-first.

### 4.6 KEK escrow

Tenant BYO keys (§8) are AES-GCM-encrypted with a platform KEK held as a
serving-worker secret, escrowed outside Cloudflare (sealed copy, documented
rotation).

## 5. Routing & app structure

### 5.1 Next.js restructure

- `src/app/(platform)/…` — apex surfaces: marketing/directory home, `/start`
  signup, platform `/admin`, legal.
- `src/app/t/[tenant]/…` — today's entire app (community pages, tenant
  admin, tenant API routes). Never user-visible:
  - `claudecommunities.com/<slug>/…` → rewrite `/t/<slug>/…`
  - custom domain → registry lookup (cached, §9.2) → rewrite to the same.
- **Normalize before matching**: every existing middleware allowlist is
  path-literal (`src/middleware.ts:62-127`) and now faces two URL shapes
  (`/india/events` vs `/events` on a custom domain). The middleware strips
  the tenant prefix / resolves the host *first*, then runs allowlists,
  Clerk, and maintenance checks against the normalized tenant-relative
  path.
- **MCP/OAuth discovery**: per-tenant MCP endpoints (`/<slug>/api/mcp`,
  `customdomain/api/mcp`) need RFC 9728 protected-resource metadata served
  per tenant path/host, not only at the apex `.well-known`. Single Clerk
  issuer keeps tokens uniform; **org context must NOT be taken from the
  token** (§6).
- **Links render from the registry's canonical mode, not the request
  host**: `tenantHref()` consults the tenant's canonical base URL so ISR
  HTML never embeds the wrong shape (§5.2). Sitemaps, OG, canonical tags,
  and email links use the same source.
- Reserved slugs (`admin`, `api`, `start`, `sign-in`, `t`, `_next`, …)
  defined in the Phase 0 slug policy.

This restructure touches essentially every file under `src/app` — the
largest mechanical change in the plan; it's why Phase 1 is XL.

### 5.2 Tenant config fully runtime + ISR

- No per-tenant builds → everything in `REGION_CONFIGS` becomes data:
  routing essentials in the registry; everything admins edit in
  `TenantSetting` (tenant DB) with adversarial per-key validation (image
  URLs via `isStorageUrl()`/known paths, `gaId ~ ^G-[A-Z0-9]+$`,
  host-allowlisted external links, text rendered as text).
- `REGION`/`getRegionConfig()` (`src/lib/region.ts:74`) are deleted; all
  ~98 consumers migrate to async request-scoped `getTenantConfig()`.
- ISR: per-tenant pages cache under the rewritten `/t/<slug>` path; tags
  include the slug (`tenant:<slug>:settings`); settings saves
  `revalidateTag`. **Domain lifecycle events (attach/detach/canonical
  flip) revalidate `tenant:<slug>:*` wholesale.**
- Remaining build-time publics are platform-level only (Clerk publishable
  key, apex URL).

## 6. Identity: one Clerk app + Organizations

1. **Clerk orgs carry membership + a coarse role only** (`owner` / `admin` /
   `member`). Org roles are application-global — they cannot express
   per-tenant custom roles; the tenant-DB `Role` table (JSON permission
   arrays behind `getRolePermissions()` and `<Can>`) **remains the truth
   for fine-grained permissions**. `setUserRole` (org-scoped now) syncs the
   coarse tier to the org membership.
2. **Tenant identity always comes from the URL/host chokepoint — never from
   the session.** Clerk sessions have one *active organization* at a time;
   two community tabs flip it globally, so trusting the JWT org claim
   authorizes against the wrong tenant. The session proves *who*; membership
   + role are checked against the URL-resolved tenant. Applies doubly to
   MCP (`src/lib/mcp/tools.ts`). CI carries a cross-tab / cross-tenant
   authz test.
3. **Tenant admin definition**: approval makes the requester org owner.
   Platform admin grants/demotes further admins from platform `/admin` —
   in-process, writing Clerk org membership + tenant-DB mirror in one
   audited service call. `PendingAdminGrant` (lowercase-matched at first
   sign-in in `resolveSessionUser()`) covers invitees with no account yet;
   the `src/lib/auth.ts:69-73` case-sensitivity fix is Phase 0.
4. Platform admins are marked by `publicMetadata.platformRole` only.
5. **Custom-domain auth = Clerk satellite domains**: per-request
   `isSatellite`/`domain` config in `clerkMiddleware` and `ClerkProvider`,
   extra DNS on the tenant domain, per-domain cost — its own Phase 3 work
   item.
6. **Clerk cost reality** (§11): the gating feature is **unlimited members
   per org** (free caps at 5); Pro meters ~$1/MAO past 100 orgs; MAU
   pricing covers all tenants' users. No custom-org-roles add-on needed.

## 7. Custom domains (Cloudflare for SaaS)

- Tenant admin enters a domain → provisioning worker creates the Custom
  Hostname → UI shows CNAME + TXT validation → cert issues → middleware
  maps host → tenant. Status surfaced in tenant admin.
- Plumbing prerequisites (Phase 3): fallback origin / `*/*` zone route on
  the SaaS zone, and the orange-to-orange playbook for tenant domains
  already on Cloudflare.
- Canonicalization: when live, `/slug` 301s to the domain; registry stores
  the canonical base URL; attach/detach fires the §5.2 wholesale
  revalidation.
- Clerk satellite-domain registration is part of the attach flow.
- AU/NZ end up as custom-domain tenants and keep their domains/SEO (§10).

## 8. External services per tenant

| Service | Model |
|---|---|
| Resend | Platform API key. Per-tenant sending domains added via Resend API (DNS shown in tenant admin); default `<slug>@mail.claudecommunities.com`. Platform webhook, fan-out by tenant tag. |
| LinkedIn | Platform LinkedIn app; per-tenant OAuth tokens already in tenant DB. **Current app is Development tier (~500 req/day, app-wide)** — serving many unrelated organizations requires **Standard tier** vetting ([app review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2025-11)): calendar dependency, filed in Phase 0; per-tenant throttling; **Zernio is the interim multi-tenant path**. |
| Zernio | Per-tenant API key entered by tenant admin, AES-GCM-encrypted in tenant DB with the platform KEK (escrowed, §4.6). |
| Anthropic | Platform key + per-tenant metering; BYO encrypted key later. |
| GA | Per-tenant `gaId` setting (validated), injected at render. |
| Internal secrets | Platform-level Worker secrets, unchanged. |

Nothing reads a tenant credential except `tenantSecrets.ts`
(decrypt + audit), enforced by the eslint lockdown.

### Storage (R2)

One bucket, per-tenant prefixes — enforced server-side, because today the
prefix is attacker-controlled: `src/app/api/upload/route.ts:31` takes
`folder` from the client straight into the key. New rules: the storage
chokepoint derives `t/<slug>/` from tenant context; client `folder` is a
sanitized sub-path only; `/api/files/[...key]` serves only keys under the
resolved tenant's prefix (with a legacy-alias map, §10); rate-limit keys
include the tenant id.

## 9. Platform surfaces & operations

### 9.1 Signup → approval → live

1. `/start`: signed-in user applies — name, slug (validated against policy
   + reserved list), locale, pitch → registry `status=pending`.
2. Platform admin approves at apex `/admin` → enqueue provision (§4.3) →
   typically live in ~1–2 minutes → applicant lands in their
   `/admin/settings` onboarding checklist.
3. Tenant configures (branding, invites, cities, custom domain) — public
   site live throughout at `claudecommunities.com/<slug>`.

### 9.2 Platform admin (apex `/admin`, behind `platformRole`)

- Approvals queue; tenant CRUD; grant/demote tenant admins; audit log.
- **Suspend/resume**: registry `status=suspended` → middleware 503s that
  tenant; cron/workflows skip it. Status checked on *every* request through
  an in-isolate cache (TTL ~30 s) with an active purge.
- Fleet view: tenants × status × migrationTag × dataWorkerVersion × health.
  ⚠ Health probes are **chunked** (≤25 dispatches per backend request, or
  fanned out via the jobs queue) — one request probing N tenants hits the
  32-invocation cap past ~30.

### 9.3 Cron, queues & workflows ⚠ (wiring made explicit in round 3)

- New queue **`tenant-jobs`**: `scheduled()` reads `live` tenants and
  enqueues one message per tenant; a consumer processes each tenant's drain
  in its own invocation (own 32-invocation budget; drain work chunked),
  entering tenant context explicitly via `runWithTenant(msg.tenantId, …)`
  (§4.2).
- This is real Phase 2 work, not configuration: today the app is queue
  **producer-only** (`wrangler.jsonc:104-111`) and
  `scripts/inject-workflow-exports.mjs` injects exactly `scheduled()` +
  workflow re-exports — it must be extended to inject a `queue()` handler,
  and the consumer must be configured on the serving worker.
- Workflow payloads carry `tenantId`; steps use the same explicit context
  entry.
- Notifications: single account → the `app-notifications` queue serves all
  tenants, messages tagged with tenant (retires the NZ
  notifications-dropped defect).

### 9.4 Staging, local dev, CLI

- **Staging** = dedicated staging serving-worker + provisioning worker +
  `PLATFORM_DB` + staging dispatch namespace (`tenants-staging`) + its own
  Clerk app, carrying synthetic tenants + a refreshable AU clone.
  Production tenant count never exists on staging; version gates and §10
  rehearsals run here. Phase 0 verifies gradual deployments coexist with
  the DO (`DOQueueHandler`) and Workflows bindings.
- **Local dev**: `npm run dev` serves the platform + seeded local tenants;
  `dev:tenant <slug>` creates/seeds a local D1 + namespace entry. ⚠ Two
  modes, used deliberately: the fast shim (remote-D1 client straight onto
  `--local` D1s) for everyday `next dev`, and `wrangler dev` multi-worker
  mode exercising the **real session protocol + template** — the shim
  bypasses exactly the code that needs testing, so CI integration tests run
  the real-protocol mode.
- **CLI** (`cli/`): `cli/src/config.ts:4` hardcodes the AU URL — gains
  `--tenant <slug>`/base-URL config; rename/branding decision in Phase 0.

## 10. Migration of AU and NZ onto the platform

1. Seed AU/NZ as tenants (registry + settings from `REGION_CONFIGS`).
2. **Data**: `wrangler d1 export` → import into `cc-t-au`/`cc-t-nz`. R2
   objects copied under tenant prefixes; stored keys rewritten **and** a
   legacy→new key alias map kept in `/api/files` (or copy-don't-move) —
   already-sent emails and published posts embed old absolute
   `/api/files/<key>` URLs.
3. **Users**: Clerk import assigns **new user ids** — the old→new `clerkId`
   map (needed for org-membership creation anyway) is applied to the
   imported tenant DBs as an explicit step; the email-link path in
   `src/lib/auth.ts` is the fallback, not the mechanism. Riskiest
   user-facing step: full staging rehearsal + sign-in-again fallback story.
4. **Domains**: `.com.au`/`.co.nz` attach as custom hostnames; DNS cutover
   with old workers kept hot for rollback.
5. Retire the NZ Cloudflare account + per-region deploy scripts.

## 11. Costs (order of magnitude, corrected meters)

- **Workers for Platforms: $25/mo** + inbound requests + CPU-ms
  (~$0.02/M ms past 60M included) + **~$0.02/script/mo past 1,000 data
  workers**. Dispatch subrequests are *not* billed per-call; the spike
  validates real CPU-ms per page with the session transport.
- Cloudflare for SaaS: first 100 custom hostnames free, then ~$0.10/mo
  each.
- Clerk: MAU across **all** tenants + orgs metering (~$1/MAO past 100) +
  satellite-domain fees; **unlimited org members requires a paid tier** —
  the main vendor cost lever; feeds the "who pays / tenant pricing"
  decision.
- LinkedIn Standard tier: free but a vetting/calendar cost (§8).
- D1/R2: usage-based; per-tenant DBs and data workers cost ~nothing at
  rest.
- Shared browser-rendering/workflow capacity → per-tenant quotas in
  `TenantSetting` limits, with W4P custom limits as a hard backstop.

## 12. Phasing

| Phase | Delivers | Size |
|---|---|---|
| **0. Spike + foundations (go/no-go gate)** | ⚠ **Leg #0: the 32-invocation rule vs dispatch calls, and the session transport** — WebSocket-over-dispatch (and/or RPC session stub) carrying N pipelined queries in 1 invocation; **adapter-conformance corpus** through `PrismaD1(remoteD1)` vs a direct binding (P2002 unique-violation, `Bytes` round-trip, `$transaction`, `raw()`, `meta.changes` — byte-identical behavior); latency: sequential, parallel, 15-query page; create-D1 → upload → migrate-through-worker loop incl. multi-statement splitting; template fan-out across 100 synthetic tenants + in-flight survival; `wrangler dev`/`getPlatformProxy` both dev modes; gradual-deploy × DO/Workflows; W4P CPU-ms billing validation. Also: slug/worker-name policy + reserved list; `auth.ts` lowercase fix; LinkedIn Standard-tier application filed; Clerk org-model mapping spike; pricing/"who pays" decision | L |
| **1. Tenant-aware core** | App restructure (`(platform)` + `/t/[tenant]`, normalize-then-match middleware), chokepoint (lazy derivation from rewrite/header + explicit `runWithTenant` for non-HTTP; remote-D1 session client + PrismaD1 reuse; storage prefix enforcement incl. the upload `folder` fix), registry + `TenantSetting` + validation, region.ts deletion + ~98-consumer migration, identity rules of §6, cross-tenant CI tests. Exit: AU runs as a path tenant on staging end-to-end **through a data-worker session**. | XL |
| **2. Platform plane** | Provisioning worker + queues (`PROVISION`, `tenant-jobs` + consumer wiring incl. `inject-workflow-exports.mjs` extension), `TENANT_PROVISION`, `/start` signup + approvals, platform `/admin` (approve/suspend/admins/fleet-with-chunked-health/audit), tenant-aware cron via queue fan-out, notifications tagging, data-worker template lifecycle (versioning, canary fan-out, drift repair), migration fan-out + version gate, KEK setup + escrow | L |
| **3. Custom domains** | Cloudflare for SaaS (fallback origin, zone route, O2O playbook), attach flow + cert status UI, Clerk satellite domains, canonical-URL handling + domain-event wholesale revalidation | L |
| **4. AU/NZ migration** | §10 with staging rehearsal (incl. clerkId rewrite + R2 alias map); retire stamp deploys + NZ account | L |
| **5. SaaS polish** | Tenant quotas (incl. W4P custom limits) + BYO encrypted keys, offboarding/data export, billing if/when monetized, directory/discovery on the apex | M |

Phases 0–2 deliver the product promise (self-serve path tenants); 3–4 add
BYO domains and bring the existing communities home.

## 13. Risks & open questions

- **Phase 0 leg #0 is the gate**: if the multiplexed session can't be made
  to work cleanly (32-invocation rule + protocol fidelity + latency),
  fallbacks in order: (a) v4's direct-binding design for the first few
  hundred tenants (hazards known and managed, operationally uglier),
  (b) last resort, shared DB with `tenantId`.
- **Isolation regression vs stamps**: tenant resolution + data-worker-name
  selection is the security boundary — chokepoint + eslint rule + CI tests
  (multi-tenant-in-one-request, cross-tab org claim, storage prefix
  escape).
- **Protocol fidelity drift**: the remote-D1 conformance corpus runs in CI
  forever, not just in the spike — a data-worker template change that
  re-wraps an error message would silently break Prisma error handling.
- **Data-worker fleet drift**: template versions observable in fleet view,
  canary rollouts, `repair` path.
- **Clerk user migration** (§10.3) is the riskiest user-facing step.
- **One serving-worker deploy, all tenants**: gradual deployments + staging
  fleet + expand-contract migrations.
- Open: keep the apex as a community directory (Skool-style discovery)?
- Open: tenant pricing/billing — free while invite-only, or Stripe from
  day one?
- Open: non-English tenants (Swiss/Thai) — copy is tenant data already, but
  static UI strings/date formats need an i18n decision eventually.
