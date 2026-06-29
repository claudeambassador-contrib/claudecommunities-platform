# Multi-Region Plan — Australia + New Zealand

**Status:** code complete, reviewed, fully region-localized, and NZ-build-validated · external provisioning + seed pending · 2026-05-30

## Implementation status

**Done (in code, tsc-clean, no new lint issues):**
- `src/lib/region.ts` — `Region` type, `REGION` (from `NEXT_PUBLIC_REGION`,
  defaults `"au"`), `REGION_CONFIGS`, `getRegionConfig()`.
- `src/lib/cities.ts` — `region` field on `City`; 19 AU + 10 NZ cities;
  `CITIES` filtered to current region, `ALL_CITIES` exposes the full list.
- Locale parameterised: `"en-AU"` → `getRegionConfig().lang` across ~40
  components/services (date/time formatting, `inLanguage`, `<html lang>`),
  plus the maintenance page title/lang in `src/middleware.ts`.
- `wrangler.jsonc` — `production-nz` / `staging-nz` envs (placeholder
  `account_id` + D1 ids), `NEXT_PUBLIC_REGION` on every env.
- `package.json` — `nz:*` deploy/migrate/seed/maintenance scripts +
  `deploy:all` / `d1:migrate:all`.
- `.env.example` documents `NEXT_PUBLIC_REGION`; committed `.env.nz.staging.example`
  / `.env.nz.prod.example` templates (placeholders only; real `.env.nz.*` stay
  gitignored).
- **Region-correctness fixes** (from the multi-agent review): metadata/SEO/OG,
  canonical URLs, GA id, email FROM + logo, sitemap/robots, timezone resolution +
  editor dropdowns, JSON-LD `addressCountry`, and `react-big-calendar` locale are
  all region-driven. AU behaviour unchanged.
- **Build-time guard:** the `staging:deploy` / `production:deploy` /
  `nz:*:deploy` scripts now force `NEXT_PUBLIC_REGION` explicitly and echo the
  build region, so a deploy can't silently bake the wrong region from a missing
  env var.
- **NZ staging gets its own D1** (`claudecommunity-nz-db-staging`) — no longer
  shares the prod database name.
- **Full region localization:** all marketing/SEO copy, ~70 absolute
  `claudecommunity.com.au` URLs (canonical/OG/JSON-LD), the email subsystem
  (senders, domains, template links, AI-prompt base URLs), `verticals.ts`
  industry copy, and the PWA manifest (now a dynamic `src/app/manifest.ts`) are
  region-driven. AU-only event pages (Melbourne Impact Lab, AU webinar replay)
  are region-gated (`if (REGION !== "au") notFound()`).
- **Validated:** `NEXT_PUBLIC_REGION=nz bun run build` completes — all 135
  pages compile and statically generate with NZ branding (only requires the
  Clerk key the real deploy already provides).

**Still required (external / manual):**
1. Provision the NZ Cloudflare account + D1 + R2; replace the
   `REPLACE_WITH_NZ_*` placeholders in `wrangler.jsonc`.
2. Create the NZ Clerk instance + Resend sender; copy `.env.nz.*.example` →
   `.env.nz.*` and fill real values (incl. the NZ account's
   `CLOUDFLARE_API_TOKEN`); verify `claudecommunity.co.nz` in the NZ Resend account.
3. Build the **one-time AU→NZ localized seed** — the `nz:*:d1:seed` scripts
   currently point at the shared `scripts/seed.sql`; the localized export of
   AU's global content (dropping AU-only rows) is **not yet built**.
4. Localize **subjective marketing copy** for NZ — superlative/claim strings like
   "Australia's largest Claude Code community" are left as content (changing the
   country name alone would assert an unverified claim). Neutral country-name and
   structured-data strings are already region-driven.

---

**Status:** proposed (awaiting review) · 2026-05-30

## Model: one codebase, two deployments, differ by env vars

AU and NZ are **separate deployments of the same Worker**, isolated by
configuration — separate Clerk instance, separate D1 database (separate
members), separate email config. There is **no shared database and no
`region` column**; isolation is physical, so there is nothing to scope and no
cross-region leakage to defend against.

```
                       one git repo (shared code)
                 /                                   \
   wrangler --env production-au            wrangler --env production-nz
   Cloudflare account: AU                  Cloudflare account: NZ  (separate)
   ccau                                    ccnz
   claudecommunity.com.au                  claudecommunity.co.nz
   DB: claudecommunity-db (AU acct)        DB: claudecommunity-nz-db (NZ acct)
   R2/Clerk/Resend: AU                     R2/Clerk/Resend: NZ
```

AU and NZ are on **separate Cloudflare accounts** — separate billing,
dashboards, and resources. The same codebase deploys to each using that
account's `account_id` + API token. This is more isolated than the repo's
current `production`/`staging` split (which share one account); the shape is the
same, but each env carries its own account credentials.

**"Both AU and NZ ambassadors keep putting changes in and benefit everyone"** is
satisfied by the **shared repo**: every merge ships to both deployments. The
codebase is the shared asset; data, members, and accounts are per-region.

This is exactly how the repo already separates `production` vs `staging` in
`wrangler.jsonc` — same code, different `name` / domain / D1 id / bucket, with
Clerk + email keys sourced from a per-env file (`.env.prod`, `.env.staging`) by
the deploy scripts (`set -a && . ./.env.prod && …`). Adding NZ = adding one more
environment in the same shape.

## What is per-region (env var / binding) vs shared (code)

| Per-region (config) | Shared (code, in the repo) |
|---|---|
| Clerk instance — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN` | All app logic, routes, components |
| D1 database (members + all data) — `DB` binding → different `database_id` | Prisma schema + migrations (run per env) |
| Domain — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `routes` | Permissions registry, services, MCP tools |
| Email sender — Resend key / from-address / footer | Email templates + `CampaignSendWorkflow` |
| Social accounts — `LINKEDIN_CLIENT_ID/SECRET`, Zernio key | Social provider registry + workflows |
| R2 bucket — `STORAGE` binding (separate bucket per region) | Storage service (`src/lib/storage.ts`) |
| Region identity — new `NEXT_PUBLIC_REGION=au\|nz` var | Branding/copy/cities **driven by** that var |
| Other secrets — `RENDER_SIGNING_SECRET`, `CRON_SECRET`, `SOCIAL_OAUTH_STATE_SECRET` | — |

## Content decision (resolved)

**Each region owns its own content; NZ is seeded once from AU at setup, then
the two drift independently.**

Separate databases mean content is not automatically shared — courses, lessons,
badges, roles, slide presets all live in each region's own DB. At launch we:

- Export AU's **global** content (courses, lessons, badges, roles, membership
  tiers) to a one-time SQL seed and load it into the NZ DB (extends the existing
  `*:d1:seed` script pattern).
- **Localize the seed for NZ**: NZ cities/timezones (`Pacific/Auckland`),
  currency (NZD), copy ("New Zealand"), and drop AU-only seed rows (AU cities,
  AU-specific events). Region-specific data is not copied.
- After seeding, NZ ambassadors maintain NZ content; AU is untouched.

A **shared content layer** (so a course authored once benefits every region) is
**deferred** — see below. Not needed to launch.

## Shared content layer (deferred — design captured for later)

Not being built now. Recorded so the decision is ready when both regions are
live and we can see what actually needs sharing.

**Feasibility under separate accounts:** AU and NZ live on **different
Cloudflare accounts**. R2 buckets and D1 databases are account-scoped, so a
Worker on one account **cannot bind** a bucket or DB on the other. Any sharing
must go over the network (GH Actions deploying to both accounts, or the S3 API
for R2) — never a binding.

Two viable approaches, to choose from when we revisit:

- **A. Content-as-code + GH Actions sync (recommended).** Global content lives
  as files in the repo (single source of truth); on merge to `main` a GH Action
  upserts it into **each account's** D1 using that account's API token
  (`wrangler d1 execute` against the AU account, then the NZ account). Shared
  media is **duplicated into each account's R2 bucket** by the same pipeline
  (no shared bucket possible). Account-agnostic and the purest "PR benefits
  everyone" — but course authoring moves from the admin UI into git (or needs an
  export bridge).
- **B. Canonical region + sync pipeline.** Keep authoring in AU's admin UI/DB; a
  GH Action exports the "global" tables from AU and upserts into the NZ account's
  DB. Authoring UX unchanged, but one-way (only AU authors shared content).

> **Off the table with separate accounts:** a shared D1/R2 *binding*
> (live-shared content read at runtime). Cross-account R2 is only reachable via
> the S3 API with access keys — runtime coupling + credential management we
> don't want. If live-shared content ever becomes a hard requirement, that's the
> only path, and it argues for revisiting a single account.

Leaning A — but defer the choice.

## Build steps

Mostly configuration; one small code change. No schema changes.

**Step 1 — Provision the NZ Cloudflare account + resources.**
- Create / obtain the **NZ Cloudflare account** → its `account_id` and an API
  token scoped to it (Workers, D1, R2 edit).
- On the NZ account: create D1 `claudecommunity-nz-db` (`wrangler d1 create`),
  R2 bucket `claudecommunity-nz-uploads` (+ `-staging`), and add
  `claudecommunity.co.nz` as a zone/custom domain.
- Create a **new Clerk instance** for NZ → publishable/secret keys + JWT issuer
  domain.
- Resend: NZ sending domain / from-address. Social: NZ LinkedIn app + Zernio
  key (can defer until NZ actually posts).

**Step 2 — Add NZ Wrangler environments** in `wrangler.jsonc`: `production-nz`
and `staging-nz`, mirroring the existing AU blocks but with the **NZ
`account_id`**, NZ `name` (`ccnz`), `routes` (`claudecommunity.co.nz`), `DB`
`database_id`, `STORAGE` bucket, and `vars` (`NEXT_PUBLIC_APP_URL` etc. +
`NEXT_PUBLIC_REGION: "nz"`). Add `NEXT_PUBLIC_REGION: "au"` to the existing AU
envs.

**Step 3 — Add NZ env files + package.json scripts.** `.env.nz.prod` / `.env.nz.staging`
holding NZ Clerk + email keys **and the NZ account's `CLOUDFLARE_API_TOKEN`** so
the deploy targets the right account (the AU env files keep the AU token). Add
`nz:staging:deploy`, `nz:production:deploy`, `nz:*:d1:migrate`, `nz:*:d1:seed`
mirroring the AU scripts (`--env production-nz` / `staging-nz`, sourcing the NZ
env file).

**Step 4 — Per-region Worker secrets** (on the NZ account):
`wrangler secret put RENDER_SIGNING_SECRET --env production-nz`, plus
`CRON_SECRET`, `SOCIAL_OAUTH_STATE_SECRET`, and any others currently set as
secrets on AU.

**Step 5 — Parameterise branding/locale by `NEXT_PUBLIC_REGION`** (the only
code change):
- `src/lib/cities.ts` — add a `region` field per city and add NZ cities
  (Auckland, Wellington, Christchurch, …, `Pacific/Auckland`); filter the
  exported list by `NEXT_PUBLIC_REGION`.
- `src/middleware.ts` — maintenance page `lang` (`en-AU`/`en-NZ`) and the
  "Community Australia/New Zealand" title from the region var.
- Any other hardcoded "Australia"/currency/timezone strings → read from a small
  `src/lib/region.ts` config map keyed by `NEXT_PUBLIC_REGION` (currency
  AUD/NZD, default timezone, display name, locale).

**Step 6 — Stand up NZ.** Run NZ migrations (`nz:production:d1:migrate`),
seed content per the decision above, configure NZ Clerk/email, deploy
(`nz:production:deploy`), point `claudecommunity.co.nz` at the Worker.

**Step 7 — Ongoing.** Both deploys ship from `main`. A normal release becomes
"deploy AU **and** NZ" — add a combined script or CI matrix so neither is
forgotten. Migrations run once per region.

## Risks / notes

1. **Deploy-both discipline.** Two deployments on two accounts means every
   release and every migration must run for both. Mitigate with a single
   `deploy:all` / `d1:migrate:all` script (or CI matrix) so NZ never silently
   lags AU.
2. **Two sets of account credentials.** Deploys and CI need the AU account's
   token for AU and the NZ account's token for NZ — they are not
   interchangeable. GH Actions needs both as separate secrets
   (`CLOUDFLARE_API_TOKEN_AU`, `CLOUDFLARE_API_TOKEN_NZ`), and the matching
   `account_id` per env in `wrangler.jsonc`. A token pointed at the wrong
   account fails (or, worse, no-ops) — verify the account on first deploy.
3. **Clerk = separate user pools.** A person who joins AU is a distinct account
   from NZ — intended ("members different"). No cross-region login/SSO.
4. **One-time seed crosses accounts.** Seeding NZ from AU = `wrangler d1 export`
   from the AU account, then `d1 execute --file` into the NZ account (each with
   its own token). Localize/strip AU-specific rows in between. It's a manual,
   one-off step — not a binding.
5. **Content drift.** After the seed, AU and NZ content evolve independently.
   Fine unless a shared content layer becomes a requirement (revisit options
   A/B above — separate accounts rule out the live-shared binding option).
6. **Cost is ~2× runtime resources on two separate bills** (two accounts: two
   D1s, two buckets, two Clerk instances) — usually absorbed by free/low tiers
   at community scale, but billing is now split across two accounts.
7. **Secrets sprawl.** Each new secret must be set on **all four** envs
   (au/nz × staging/production), on the **correct account**. Keep
   `.env.example` and the scripts in sync.

## Open question for you

Which content option (1 / 2 / 3) above? That's the only decision that changes
the build — everything else is mechanical config.

## Key files

`wrangler.jsonc` (add NZ envs), `package.json` (NZ deploy/migrate scripts),
`.env.example` + new `.env.nz.*`, `src/lib/cities.ts` (region field + NZ
cities), `src/lib/region.ts` (new — region config map), `src/middleware.ts`
(locale/title from region). No changes to `prisma/schema.prisma`,
`src/lib/services/*`, `src/lib/permissions.ts`, or data access.
