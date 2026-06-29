# Multi-Tenancy — Setup From Scratch

How to stand up the multi-tenant app from nothing: local dev, a Cloudflare
deploy, and provisioning tenants. For the *design* (isolation contract, the
chokepoint, routing root-of-trust) see `multi-tenancy-isolation-spec.md`; this
doc is the operational runbook.

> **Model in one paragraph.** One codebase + one shared D1 database. Every
> tenant-scoped row carries a `tenantId`; a Prisma `$extends` chokepoint
> (`src/lib/tenant-scope.ts`) injects/enforces it. Each request is mapped to a
> tenant by `src/middleware.ts` (the root of trust) from the URL/host alone, four
> ways: **custom domain** (`acme.com`), **subdomain** (`acme.<base>`),
> **path-prefix** (`<base>/acme`), or the deploy's **home tenant** (apex/content
> on a platform host). The tenant must exist in the `Tenant` registry table or
> the request 404s (custom-domain/subdomain miss falls back to home).

---

## 0. Prerequisites

- Node 20+ and npm. (`bun` can run the scripts, but everything below is verified
  with `npm` — and the `dev`/`build` scripts run a Prisma codegen step that the
  app depends on, so don't bypass them.)
- A **Clerk** application (publishable + secret key, and a JWT issuer domain).
- For deploy only: a **Cloudflare** account with Workers Paid (Workflows +
  Browser Rendering are used), and `wrangler` authenticated (`wrangler login`).

---

## 1. Local dev from scratch

```bash
# 1. install
npm install

# 2. .env.local — see the key reference in §5. Minimum to boot:
#    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
#    CLERK_SECRET_KEY=sk_test_…
#    NEXT_PUBLIC_REGION=au
#    (no real Clerk app yet? a well-formed DUMMY publishable key renders public
#     pages — `pk_test_<base64 of "your-host$">` — but auth/signup won't work.)

# 3. create the local D1 schema (Cloudflare's local SQLite under .wrangler/state)
npm run local:d1:migrate

# 4. seed base reference data (leaderboard levels, etc.)
npm run local:d1:seed

# 5a. seed the HOME tenant (au) so the apex "/" renders real branding…
npm run local:d1:seed-tenant
#     …note: seed-tenant writes Tenant + TenantSetting ONLY. It seeds NO roles
#     and NO owner, so to actually administer "au" you still need the bootstrap
#     in §4. For a brand-new tenant you can administer immediately, use 5b instead.

# 5b. …OR provision a fresh tenant you own outright (Tenant + settings + the 3
#     system roles + a placeholder owner with super_admin):
npm run local:tenant:provision -- acme "Acme Community" you@acme.test

# 6. run it
npm run dev
```

**Visit a tenant** (any of these reach `acme`, once provisioned):

| Model | URL |
|---|---|
| Subdomain | `http://acme.localhost:<port>` — `*.localhost` resolves to loopback automatically, no `/etc/hosts` |
| Path-prefix | `http://localhost:<port>/acme` |
| Home tenant | `http://localhost:<port>/` → serves `NEXT_PUBLIC_REGION` (au) |

> ⚠️ **Port:** if `:3000` is taken, Next binds `:3001` (etc.) — use the port it
> prints (`✓ Ready on http://localhost:XXXX`).

**Become admin:** sign up *with the owner email you passed to provision*
(`you@acme.test`). `resolveSessionUser` links you to the placeholder owner via
its email link-path, so you inherit the `super_admin` membership — no extra step.
(For the **home** tenant `au`, which was seeded not provisioned, use §4 instead.)

---

## 2. Deploy to Cloudflare from scratch

The deploy builds with OpenNext and ships a Worker. `wrangler.jsonc` is already
wired for the AU account; for a **new** account/environment you must recreate the
resources and swap the ids.

### 2.1 Create the Cloudflare resources, update `wrangler.jsonc`

```bash
wrangler d1 create claudecommunity-db        # → paste database_id into wrangler.jsonc
wrangler d1 create ccau-next-tag-cache       # → paste into NEXT_TAG_CACHE_D1 (REPLACE_WITH_TAG_CACHE_D1_ID)
wrangler r2 bucket create claudecommunity-uploads
wrangler r2 bucket create ccau-next-cache
```

Bindings the Worker expects (see `wrangler.jsonc`): `DB` (D1), `STORAGE` (R2),
`NEXT_TAG_CACHE_D1`, `NEXT_INC_CACHE_R2_BUCKET`, `BROWSER` (Browser Rendering),
the `NOTIFICATIONS` queue, the `NEXT_CACHE_DO_QUEUE` Durable Object, and the
three Workflows (`SLIDE_EXPORT`, `PUBLISH_POST`, `CAMPAIGN_SEND`). Replace every
`database_id` in the env block(s) you're deploying.

### 2.2 Build-time env vs Worker secrets

- **Build-time** vars come from `.env.staging` / `.env.prod` (sourced by the
  deploy scripts) and from `wrangler.jsonc` `vars` — these are `NEXT_PUBLIC_*`
  and anything needed at build. Copy `.env.example`.
- **Runtime secrets** go in via wrangler (never commit them):

  ```bash
  wrangler secret put CLERK_SECRET_KEY        --env staging
  wrangler secret put CLERK_JWT_ISSUER_DOMAIN --env staging
  wrangler secret put RESEND_API_KEY          --env staging   # if email is used
  wrangler secret put RENDER_SIGNING_SECRET   --env staging   # slide export (HMAC)
  wrangler secret put CRON_SECRET             --env staging
  wrangler secret put SOCIAL_OAUTH_STATE_SECRET --env staging # social posting
  # LinkedIn/Anthropic/etc. as needed — see §5.
  ```

### 2.3 Multi-tenancy routing knobs (env, with safe defaults)

Override per-env only if your hostnames differ from the AU defaults:

| Var | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_REGION` | `au` | build-baked home-tenant slug |
| `HOME_TENANT` | = `NEXT_PUBLIC_REGION` | the deploy's home tenant (apex/content) |
| `PLATFORM_HOSTS` | `claudecommunities.com,localhost,127.0.0.1,workers.dev` | hosts that ARE the platform (anything else = a custom-domain tenant) |
| `TENANT_SUBDOMAIN_BASES` | `claudecommunities.com,localhost` | bases under which `<label>.<base>` = tenant `<label>` (**must NOT include `workers.dev`**, or preview deploys become tenants) |

Path-prefix tenancy (`<host>/<slug>`) is always on — no flag.

### 2.4 Migrate, seed, deploy

```bash
npm run staging:d1:migrate        # apply migrations to the REMOTE D1
npm run staging:d1:seed           # base reference data
npm run staging:d1:seed-tenant    # Tenant + TenantSetting for the home region (au)
npm run staging:deploy            # build:cf + opennextjs-cloudflare deploy --env staging
```

(`production:*` and `nz:*` variants exist; `deploy:all` ships AU+NZ prod.)

> The Prisma D1 client and the **tenant-scope maps** (`tenant-scope-maps.generated.ts`)
> are regenerated automatically by the `prisma-generate` step inside `build:cf`.
> Those committed maps are what stop the chokepoint from touching `Prisma.dmmf`
> at runtime (which throws under workerd). If you ever see *"Prisma.dmmf is not
> available in edge runtimes"*, a runtime DMMF access was re-introduced.

---

## 2b. Platform staging — `staging.claudecommunities.com` from scratch

A **clean multi-tenant SaaS deploy** with no AU baggage: its own Worker, D1, and
R2; the apex is a generic home tenant (`platform`); real communities are created
online via the configurator (§3.2) and reached at
`staging.claudecommunities.com/<slug>`. Wrangler env: **`staging-platform`**
(`wrangler.jsonc`).

This is a one-time bring-up. The cloud steps need your Cloudflare/Clerk auth, so
run them yourself (tip: type `! <command>` in this session to run a command and
capture its output here).

**1. Clerk instance** for `staging.claudecommunities.com` — a real publishable +
secret key and a JWT issuer domain. *Blocks login* (a dummy key renders public
pages but auth won't work). The `clerk-setup` skill can bootstrap one.

**2. `claudecommunities.com` as an Active zone** on the Cloudflare account, and
add `staging.claudecommunities.com` as a **custom domain** on the worker. *Blocks
reaching the site.* (Routing already treats `*.claudecommunities.com` as a
platform host.)

**3. Create the resources, paste ids into `wrangler.jsonc` → `staging-platform`:**

```bash
wrangler d1 create claudecommunity-platform-db-staging      # → DB database_id
wrangler d1 create ccplatform-next-tag-cache-staging        # → NEXT_TAG_CACHE_D1 id
wrangler r2 bucket create claudecommunity-platform-uploads-staging
wrangler r2 bucket create ccplatform-next-cache-staging
```

Replace `REPLACE_WITH_PLATFORM_DB_ID` / `REPLACE_WITH_PLATFORM_TAG_CACHE_D1_ID`.

**4. Build-time env + Worker secrets:**

```bash
cp .env.staging.platform.example .env.staging.platform   # fill in Clerk publishable key etc.
wrangler secret put CLERK_SECRET_KEY          --env staging-platform
wrangler secret put CLERK_JWT_ISSUER_DOMAIN   --env staging-platform
wrangler secret put RENDER_SIGNING_SECRET     --env staging-platform
wrangler secret put CRON_SECRET               --env staging-platform
wrangler secret put SOCIAL_OAUTH_STATE_SECRET --env staging-platform
# RESEND_API_KEY if email is used
```

**5. Migrate, seed, deploy:**

```bash
npm run platform:staging:d1:migrate                         # apply 0001–0021 to the fresh REMOTE D1
PLATFORM_OWNER_EMAIL=you@example.com \
  npm run platform:staging:seed-admin                       # home tenant "platform" + YOU as super_admin
                                                            #   + default spaces & gamification levels (tenant-scoped)
npm run platform:staging:deploy                             # build:cf + deploy --env staging-platform
```

> **No `seed.sql` here.** The legacy `scripts/seed.sql` seeds Spaces +
> LeaderboardLevels at `tenantId=''` and upserts levels on a pre-0021
> `ON CONFLICT (level)` target that migration 0021 replaced with
> `(tenantId, level)` — so it errors *"ON CONFLICT clause does not match any …
> UNIQUE constraint"* on a fresh DB. The platform seed instead generates that
> reference data **scoped to the home tenant** (`scripts/seed-reference.ts`),
> folded into `seed-admin`. To seed reference data for any other tenant:
> `npm run seed:reference -- <slug> | wrangler d1 execute DB --remote --env <env> --file=/dev/stdin`.

**6. Log in & create your first real tenant:** sign up at
`https://staging.claudecommunities.com/login` with `PLATFORM_OWNER_EMAIL` — you
inherit the seeded `super_admin`. Go to **`/admin` → Tenants**, fill the form,
and your community is live at `staging.claudecommunities.com/<slug>` (§3.2).

> **Routing note.** `TENANT_SUBDOMAIN_BASES` is set to the staging *host*
> (`staging.claudecommunities.com`), NOT the apex — otherwise the host itself
> would be misread as a tenant named `staging`. Path-prefix (`/<slug>`) is always
> on; `*.staging.claudecommunities.com` subdomain tenancy only activates once you
> add a wildcard cert.

---

## 3. Provisioning tenants

### 3.1 Local — the script (verified)

```bash
npm run local:tenant:provision -- <slug> "<Display Name>" <ownerEmail> [customDomain]
```

Emits idempotent SQL → local D1: `Tenant` + `TenantSetting` (default config) +
the 3 system roles + a placeholder owner `User` (claimed when that email signs
up) + an owner `UserTenant` (`super_admin`). Reach the tenant by subdomain or
path-prefix (§1).

### 3.2 Online — the admin Tenants configurator (no wrangler)

A deployed platform provisions tenants **online**, no scripts: sign in as a
global `super_admin` and open **`/admin` → Tenants** (the nav item appears only
for a global super_admin). The form takes slug + display name + owner email
(+ optional custom domain) and the tenant is live the instant it's created —
reachable at `<host>/<slug>` (path-prefix). The owner email receives
`super_admin` of that tenant when they sign up with it.

Under the hood:
- UI — `src/app/t/[tenant]/admin/tenants/` (server-gated on the **global**
  `User.role === "super_admin"`, NOT a per-tenant permission — see below).
- API — `POST /api/admin/tenants` (same global gate) → `provisionTenantByEmail()`
  in `services/tenants.ts` (find-or-create the placeholder owner, then
  `provisionTenant()`).

> **Why a global gate, not a `<Can>` permission?** System roles seed with
> `ALL_PERMISSIONS`, so a `tenants.create` permission would hand *every* tenant's
> admins the power to mint platform tenants via the unscoped platform client — a
> cross-tenant escalation. Creating tenants is platform-superuser-only, so it's
> gated on `User.role` exactly like `/api/admin/tenant-bootstrap`.

The SQL script (§3.1) and the `--remote` form remain available for headless
provisioning:

```bash
./node_modules/.bin/tsx scripts/provision-tenant.ts acme "Acme" you@acme.test > /tmp/t.sql
wrangler d1 execute DB --remote --env <env> --file=/tmp/t.sql
```

### 3.3 DNS per routing model

- **Path-prefix** (`platform.com/acme`): nothing — works immediately once the
  `Tenant` row exists.
- **Subdomain** (`acme.platform.com`): a wildcard `*.platform.com` DNS record +
  cert pointing at the Worker, and `platform.com` in `TENANT_SUBDOMAIN_BASES`.
- **Custom domain** (`acme.com`): add the domain to the Worker's routes/custom
  domains in Cloudflare, and set `Tenant.customDomain = "acme.com"` (the
  provision script's optional 4th arg, or an UPDATE).

---

## 4. The first super_admin (home tenant) + bootstrap

`POST /api/admin/tenant-bootstrap` migrates a pre-existing single-tenant deploy
into the tenant model: it ensures the home `Tenant`/settings + the system roles,
then enrolls **every existing user** as a member of the home tenant preserving
their global `User.role`. It is gated on the **caller's global
`User.role === "super_admin"`** (deliberately, since membership-based authz
doesn't exist yet at that point) — a chicken-and-egg you break once by hand:

```bash
# 1. sign up normally (creates your global User, role "member")
# 2. promote yourself in the DB (LOCAL shown; prod = --remote --env production):
wrangler d1 execute DB --local --command \
  "UPDATE User SET role='super_admin' WHERE email='you@example.com'"
# 3. call the endpoint (signed in as that user) — seeds roles + enrolls everyone:
#    POST https://<host>/api/admin/tenant-bootstrap
```

Provisioned tenants (§3.1) skip all of this — their owner is seeded with a
`super_admin` membership directly.

---

## 5. Env var reference (`.env.example`)

| Key | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **yes** | app boots/auth |
| `CLERK_SECRET_KEY` | **yes** | server auth |
| `CLERK_JWT_ISSUER_DOMAIN` | yes (MCP/JWT) | token verification |
| `NEXT_PUBLIC_REGION` | yes | home-tenant slug (`au`/`nz`) |
| `NEXT_PUBLIC_SITE_URL` | yes | canonical URL |
| `RESEND_FROM_EMAIL` / `RESEND_API_KEY` | email features | campaigns/notifications |
| `RENDER_SIGNING_SECRET` | slide export | HMAC for Browser Rendering |
| `CRON_SECRET` | cron routes | protects scheduled HTTP routes |
| `SOCIAL_OAUTH_STATE_SECRET`, `LINKEDIN_CLIENT_ID/SECRET` | social posting | LinkedIn connector |
| `ANTHROPIC_API_KEY`, `CLAUDIENCE_API_KEY`, `NEXT_PUBLIC_GA_ID` | feature-specific | AI / analytics |
| `MAINTENANCE_MODE`, `MAINTENANCE_BYPASS_TOKEN` | optional (secret) | kill-switch (`*:maintenance:on/off`) |

Local → `.env.local`. Deploy build-time → `.env.staging`/`.env.prod`
(+ `.env.nz.*`). Worker runtime secrets → `wrangler secret put … --env <env>`.
**Never** use `.dev.vars`.

---

## 6. Verify (smoke test)

With a tenant `acme` provisioned and `npm run dev` running on `<port>`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/acme          # 200, tenant home
curl -s http://localhost:<port>/acme | grep -o 'href="/acme/[^"]*"' | head     # links carry /acme/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/zzz           # 404 (non-tenant → home fallback)
```

Expected (verified on this branch): `/acme` → 200 with `/acme/…` links and zero
bare tenant-content links; non-tenant slug → home 404. The structural guard
`test/iso/tenant-links-threaded.test.ts` enforces link-threading in CI; the
isolation suite (`test/iso/**`) enforces the chokepoint.

> **Still unexercised:** the auth-gate under path-prefix (a *protected*
> `/acme/...` → Clerk login → return to `/acme/...`) needs a real signed-in
> session — verify it manually once with real Clerk keys before relying on it.

## Platform plane (the apex is not a tenant)

On a platform host (`PLATFORM_HOSTS`, e.g. `claudecommunities.com`) the apex is
**not** a community — it serves the platform plane from the top-level
`src/app/(platform)/` route group:

- `/` — the **public community directory** (`listPublicCommunities()` in
  `src/lib/services/tenants.ts`): every `status="active"` AND `listed=true`
  tenant, with its branding from `TenantSetting.config`. No auth.
- `/admin` — the **platform console** (provision / edit / suspend / hide
  communities). Gated on the GLOBAL `User.role === "super_admin"`; middleware
  also `auth.protect()`s `/admin` on the apex.

Middleware resolves these as `servePlatform` (no tenant stamp, no `/t/<slug>`
rewrite). Unknown subdomains (`www.…`) and unknown first-path-segments on the
apex also fall through to the platform plane instead of leaking the home tenant.
A community is reached only via its **slug** (`/<slug>`), **subdomain**
(`<slug>.<base>`), or **custom domain** — the apex no longer maps to a tenant.

`Tenant.listed` (default `true`) hides a community from the directory without
suspending it (still reachable on its slug/domain).

### Per-community self-service settings

Community admins edit their own community at `/<slug>/admin/settings` (gated on
the per-tenant `tenant.settings` permission — distinct from the platform
console's global gate). It writes `TenantSetting.config` + the `Tenant` registry
row (everything except the immutable slug) via the `saveCommunitySettings`
**server action** (`src/app/t/[tenant]/admin/settings/actions.ts`) — a server
action, not a flat `/api` route, so it runs in the URL tenant's scope even under
path-prefix tenancy. The "Tenants" item no longer appears inside a community's
admin (it moved to the platform console).

Existing communities' `super_admin`/`admin` roles are granted `tenant.settings`
by migration `0023_tenant_settings_permission.sql`; newly provisioned tenants
get it automatically (their roles seed from `ALL_PERMISSIONS`).
