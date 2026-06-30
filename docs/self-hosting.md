# Self-hosting on your own Cloudflare account

This runbook lets **anyone** fork this repo and deploy it to **their own, fresh
Cloudflare account** by supplying only their own values — no code changes, no
foreign account ids, no shared secrets.

It uses a single, generic deployment config — `wrangler.selfhost.template.jsonc`
— with no named `env` blocks. You render it to `wrangler.jsonc` from your own
values and deploy with **no `--env` flag** (the top level IS your deployment).

> The canonical `wrangler.template.jsonc` (the AU/NZ `production`, `staging`,
> `staging-platform`, `production-nz`, `staging-nz` envs) is for the original
> maintainers and is unaffected by anything here. Self-hosters never touch it.

> **Branding note:** today `src/lib/region.ts` carries the built-in `au`/`nz`
> brandings, selected by `NEXT_PUBLIC_REGION`. Fully env-driven, per-deploy
> branding is **Stage 3c** (next). For now pick the closest built-in region.

---

## 1. Prerequisites

- **A Cloudflare account** (free tier is enough to start) with **Workers Paid**
  if you want Durable Objects / Workflows / Browser Rendering in production
  (this app uses all three).
- **A domain you control, added to that account as an Active zone** (nameservers
  pointed at Cloudflare). The generated `routes` attach your custom domain on
  deploy and only succeed once the zone is Active.
- **Clerk** account + application (auth) — publishable + secret keys.
- An email sender: **Resend** (`RESEND_*`) **or Send16** (`SEND16_API_KEY`).
- Local tooling: **Bun** (`bun`), and **Wrangler** (`bunx wrangler`), logged in:
  `bunx wrangler login`.

---

## 2. Provision your infrastructure (run once)

On your account, create **2 D1 databases** and **2 R2 buckets**, plus the
notifications queue, then copy the ids into `.env.selfhost` (next step):

```bash
# D1 — primary application database  -> CF_D1_ID
bunx wrangler d1 create claudecommunity-db

# D1 — OpenNext tag cache (separate db) -> CF_D1_TAGCACHE_ID
bunx wrangler d1 create claudecommunity-next-tag-cache

# R2 — user uploads  -> CF_R2_BUCKET (use the bucket name)
bunx wrangler r2 bucket create claudecommunity-uploads

# R2 — OpenNext incremental cache -> CF_R2_CACHE_BUCKET (use the bucket name)
bunx wrangler r2 bucket create claudecommunity-next-cache

# Queue — cross-service notifications producer (NOTIFICATIONS binding)
bunx wrangler queues create app-notifications
```

Where each value comes from:

| Token | Source |
|---|---|
| `CF_ACCOUNT_ID` | Dashboard → any domain → Overview → right sidebar "Account ID" |
| `CF_WORKER_NAME` | A name you choose (lowercase/hyphens), e.g. `claudecommunity` |
| `CF_D1_ID` | `database_id` printed by `wrangler d1 create claudecommunity-db` |
| `CF_D1_TAGCACHE_ID` | `database_id` from `wrangler d1 create claudecommunity-next-tag-cache` |
| `CF_R2_BUCKET` | The bucket name you created for uploads |
| `CF_R2_CACHE_BUCKET` | The bucket name you created for the cache |
| `CF_ROUTE` | Your custom hostname, e.g. `community.example.org` |
| `CF_PUBLIC_URL` | Public origin, e.g. `https://community.example.org` |
| `NEXT_PUBLIC_REGION` | `au` (default) or `nz` |
| `HOME_TENANT` | Home tenant slug, e.g. `platform` |
| `PLATFORM_HOSTS` | Hosts that ARE the platform, e.g. `example.org,localhost,127.0.0.1,workers.dev` |
| `TENANT_SUBDOMAIN_BASES` | Base host for `*.<base>` tenants, e.g. `example.org` |

> If you don't run a notifications consumer worker, you can delete the `queues`
> block from `wrangler.selfhost.template.jsonc` instead of creating the queue.

See `docs/multi-tenancy-setup.md` for what `HOME_TENANT` / `PLATFORM_HOSTS` /
`TENANT_SUBDOMAIN_BASES` mean in detail.

---

## 3. Supply your values

Pick **one** of these:

### Option A — local file (local / manual deploys)

```bash
cp .env.selfhost.example .env.selfhost   # then fill in YOUR values
```

`.env.selfhost` is gitignored (covered by the `.env*` rule;
`.env.selfhost.example` stays committed via the `!.env.*.example` negation).
`gen-wrangler` auto-loads it only when you pass it explicitly:

```bash
bun run gen:wrangler:selfhost   # auto-loads .env.selfhost, renders wrangler.jsonc
# equivalent explicit form:
node scripts/gen-wrangler.mjs --template wrangler.selfhost.template.jsonc --infra-file .env.selfhost
```

> When the self-host template is selected, `gen-wrangler` auto-loads
> `.env.selfhost` (just as the canonical path auto-loads `.env.cfinfra`). Pass
> `--infra-file <path>` to point at a different file.

### Option B — Cloudflare Workers Builds (hosted, on merge to `main`)

In **Workers & Pages → (your worker) → Settings → Builds**, connect your fork:

1. **Build command:** `bun install && bun run build:cf:selfhost`
2. **Deploy command:** `bunx opennextjs-cloudflare deploy`  *(no `--env`)*
3. **Variables — add all 12 generic tokens** from `.env.selfhost.example` with
   your values. On the runner there is no `.env.selfhost`, so `gen-wrangler`
   reads these dashboard variables.
4. **Build-time public vars (also required as Variables).** Next.js inlines
   `NEXT_PUBLIC_*` at **build** time, so they must be on the runner — not just
   as runtime secrets. At minimum set **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`**
   (the build fails without it), plus `CLERK_JWT_ISSUER_DOMAIN`, and optionally
   `NEXT_PUBLIC_GA_ID`.
5. **Runtime secrets** (encrypted): see step 6.

Every merge to `main` then auto-builds and deploys to your account.

---

## 4. Build and deploy

**Local / manual:**

```bash
bun install
bun run build:cf:selfhost     # gen-wrangler (self-host template) -> opennext build
bunx opennextjs-cloudflare deploy   # NO --env: deploys the top-level config
# one-shot equivalent:
bun run selfhost:deploy
```

**Hosted:** the Workers Builds commands above run these for you on each push.

You can validate the generated config without deploying:

```bash
bun run gen:wrangler:selfhost
bunx wrangler deploy --dry-run --outdir /tmp/wd
```

---

## 5. Database migrations (deliberate, separate step)

Workers Builds does **not** run migrations. After the first deploy (and whenever
the schema changes), apply them against your account:

```bash
bunx wrangler d1 migrations apply DB --remote
```

Because the self-host config has no named envs, there is **no `--env` flag** —
the `DB` binding resolves from the generated top-level `wrangler.jsonc`.

---

## 6. Runtime secrets

Set these as Worker secrets (never commit them). No `--env`:

```bash
bunx wrangler secret put RENDER_SIGNING_SECRET      # HMAC for slide/PNG export
bunx wrangler secret put CLERK_SECRET_KEY
bunx wrangler secret put RESEND_API_KEY             # or SEND16_API_KEY
# optional, for social posting:
bunx wrangler secret put LINKEDIN_CLIENT_ID
bunx wrangler secret put LINKEDIN_CLIENT_SECRET
bunx wrangler secret put SOCIAL_OAUTH_STATE_SECRET
# optional kill-switch (no redeploy to toggle):
bunx wrangler secret put MAINTENANCE_MODE           # enter "true" to take the site offline
```

`NEXT_PUBLIC_*` values (e.g. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) are inlined at
**build** time, not runtime — set them in `.env.local` for local builds, and as
Workers Builds **Variables** for the hosted path (steps 3–4 above), never as
Worker secrets.

---

## 7. Seed your tenant/region + first admin

```bash
# Seed the home tenant + region row (matches your NEXT_PUBLIC_REGION):
bunx tsx scripts/seed-tenant.ts au > scripts/.tenant-seed.sql
bunx wrangler d1 execute DB --remote --file=scripts/.tenant-seed.sql

# Make yourself the first admin. The 2nd arg is the home-tenant slug and MUST
# match your HOME_TENANT (defaults to "platform" if omitted):
bunx tsx scripts/seed-platform.ts you@example.com platform > scripts/.platform-seed.sql
bunx wrangler d1 execute DB --remote --file=scripts/.platform-seed.sql
```

(Replace `au` with `nz` if that is your `NEXT_PUBLIC_REGION`.) See
`docs/multi-tenancy-setup.md` for the full first-admin bootstrap and tenant
provisioning details.

---

## 8. Done

Your fork now runs entirely on your own Cloudflare account with your own config
and secrets — no shared identifiers, no edits to the canonical AU/NZ template.
Future merges to `main` (via Workers Builds) redeploy automatically.

> Per-community branding (names, emails, Discord, images) is still selected by
> `NEXT_PUBLIC_REGION` from `src/lib/region.ts`. Making it fully env-driven so a
> brand-new community ships without editing source is **Stage 3c (next)**.
