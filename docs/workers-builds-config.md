# Cloudflare Workers Builds — config after the `wrangler.jsonc` templating (Stage 3a)

`wrangler.jsonc` is **no longer committed**. It is generated at build time from
`wrangler.template.jsonc` by `scripts/gen-wrangler.mjs`, which fills the
`${TOKEN}` placeholders (account id, worker name, D1/R2 ids, routes, public
URLs) from environment values. `main` therefore carries **no Cloudflare account
or resource identifiers**.

> ⚠️ **Read this before merging the Stage 3a PR or it will break the live
> deploy.** A Workers Builds deploy after the merge runs against a repo with no
> `wrangler.jsonc`; it must be generated during the build, and `gen-wrangler`
> hard-fails (exit 1) if any token is unset.

## Where token values come from (resolution order)

`scripts/gen-wrangler.mjs` resolves each `${TOKEN}` from, in order:

1. `--infra-file <path>` (explicit; the file must exist)
2. `./.env.cfinfra` (auto-loaded when present — local / manual deploys)
3. `process.env` (Cloudflare Workers Builds **dashboard variables**)

`build:cf` runs `gen-wrangler` first, so **both** local deploys (`scripts/deploy.mjs`)
**and** hosted Workers Builds are self-generating — the CF path can't be missed.

## Workers Builds dashboard setup (per connected environment)

In **Workers & Pages → (your worker) → Settings → Builds**:

1. **Build command:**
   ```
   bun install && bun run build:cf
   ```
   (`build:cf` runs `gen-wrangler` → `opennextjs-cloudflare build`. On the runner
   `.env.cfinfra` is absent, so `gen-wrangler` reads the dashboard Variables below.)
2. **Deploy command** (unchanged): `bunx opennextjs-cloudflare deploy` — or the
   retry wrapper `bun run production:deploy:cf` / `staging:deploy:cf`
   (`scripts/cf-deploy.mjs`).
3. **Variables & Secrets — add ALL 39 `${TOKEN}`s** from `.env.cfinfra.example`,
   set to their values. `gen-wrangler` renders the whole multi-env template in a
   single pass, so it requires **every** token to be non-empty **regardless of
   which `--env` this project deploys** — including the other regions'
   (`_NZ_*`, `_PLATFORM_*`, …). They are non-secret identity values; the blocks
   this project doesn't deploy are simply present in the generated file and
   ignored by `--env`. Also set **`CF_D1_TAGCACHE_ID_BASE`** — it only appears in
   the unused top-level block, so any non-empty value works (the maintainers use
   the historical `REPLACE_WITH_TAG_CACHE_D1_ID` placeholder to keep that block
   byte-identical).
   > **Running only one deployment?** Prefer the **12-token self-host template**
   > (`docs/self-hosting.md`) — it has no other-region tokens and one env.
4. **Runtime secrets stay as before** (`RENDER_SIGNING_SECRET`, Clerk keys,
   `RESEND_*` / `SEND16_API_KEY`, `LINKEDIN_*`, `SOCIAL_OAUTH_STATE_SECRET`,
   optional `MAINTENANCE_MODE`) — unaffected by this change.
5. **Custom domains:** the generated `routes` still require the domain to be an
   **Active zone** on that account.

> ⚠️ Do **not** set the build command to `bun run gen:wrangler && …`. On the
> runner there is no `.env.cfinfra`; `gen:wrangler` then reads `process.env`,
> which is correct — but use `bun run build:cf` so the generated config feeds the
> very next build step in the same invocation.

## Local / manual deploys

Copy the template and fill in your values (kept out of git):

```
cp .env.cfinfra.example .env.cfinfra   # then fill in the real values
bun run staging:deploy                 # or production:deploy / nz:* — auto-generates wrangler.jsonc
```

`scripts/deploy.mjs` → `build:cf` → `gen-wrangler` auto-loads `.env.cfinfra`.

## Migrations

Unchanged and still a deliberate, separate step — Workers Builds does **not** run
them: `wrangler d1 migrations apply DB --remote --env <env>`.

## Coordination gate

The previously-committed AU + NZ values now live only in the gitignored
`.env.cfinfra` (locally) and must be present in each account's dashboard before
that account's next deploy. NZ is moving to its own account — a natural cutover
point.
