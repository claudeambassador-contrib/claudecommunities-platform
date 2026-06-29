# Claude Community Australia

Next.js app behind [claudecommunity.com.au](https://claudecommunity.com.au) — events,
community feed, courses, member directory, email campaigns, an Impact Lab
hackathon portal, and an MCP server for `claude.ai`.


## Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Runtime**: Cloudflare Workers via [`@opennextjs/cloudflare`](https://github.com/opennextjs/opennextjs-cloudflare)
- **Database**: Cloudflare D1 (SQLite), bound as `DB`
- **ORM**: Prisma 7 with `@prisma/adapter-d1`, plus raw-SQL helpers in `src/lib/db.ts`
- **Auth**: Clerk
- **Storage**: Cloudflare R2 (bound as `STORAGE`)
- **Email**: Resend
- **Browser rendering**: Cloudflare Browser binding (`BROWSER`) for slide PNG exports
- **MCP**: `@modelcontextprotocol/sdk` mounted under `/api/mcp` (separate CLI in `cli/`)
- **Lint/format**: Biome (primary) + a slim ESLint config for Next-specific rules

## Quick start

```bash
# 1. Install
bun install

# 2. Create .env.local with the keys listed in .env.example

# 3. Apply migrations to a local D1 database
bun run local:d1:migrate
bun run local:d1:seed     # optional fixtures from scripts/seed.sql

# 4. Run the dev server (auto-runs build:mcp-ui + prisma generate)
bun run dev
```

Open <http://localhost:3000>.

### Run against the Worker locally

```bash
bun run preview    # build:cf, then wrangler dev with bindings
```

`bun run dev` is Next on Node with `DEPLOY_TARGET=cloudflare` set so Prisma
emits the D1-compatible client. `bun run preview` builds with
`opennextjs-cloudflare` and serves through Wrangler — use it when verifying
D1, R2, MCP, or Browser-binding behavior end-to-end.

## Build & deploy

| Script | What it does |
|---|---|
| `bun run dev` | Next.js dev server with the D1 Prisma client |
| `bun run build` | Next.js production build (Cloudflare target) |
| `bun run build:cf` | `opennextjs-cloudflare build` + workflow-export injection |
| `bun run preview` | Build + run via Wrangler |
| `bun run staging:deploy` | Deploy to `ccau-staging` using `.env.staging` |
| `bun run production:deploy` | Deploy to `ccau` using `.env.prod` |
| `bun run lint` / `format` / `check` | Biome (+ Next ESLint) |

GitHub Actions deploy is currently disabled (see commit `b6cf688`). Deploy
from a local checkout with the scripts above.

### D1 migrations

```bash
bun run d1:generate                       # diff prisma/schema.prisma → migrations/NNNN_*.sql
bun run local:d1:migrate                  # apply locally
bun run staging:d1:migrate                # apply to staging
bun run production:d1:migrate             # apply to production
```

`scripts/d1-generate-migration.mjs` snapshots the last-applied schema in
`migrations/.last-schema.prisma`, so each generate produces an incremental
diff.

### Maintenance mode

```bash
bun run production:maintenance:on    # sets MAINTENANCE_MODE=true secret
bun run production:maintenance:off   # deletes the secret
```

`src/middleware.ts` returns a 503 page when the flag is on. A `?bypass=<token>`
escape hatch is supported — see `e22302e`.

## Env vars

Use `.env.local` for dev, `.env.staging` / `.env.prod` for deploys, and
`wrangler secret put <NAME> --env <staging|production>` for Worker secrets.
**Don't use `.dev.vars`** — that path is outdated.

See `.env.example` for the full list. The most-needed ones:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk auth |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT verification for the MCP server |
| `ANTHROPIC_API_KEY` | Server-side Claude calls (digest, MCP tools) |
| `RESEND_API_KEY` | Transactional + campaign email |
| `CLAUDIENCE_API_KEY` | Proxy to the Claudience API |
| `RENDER_SIGNING_SECRET` | HMAC for slide-PNG render URLs |
| `MAINTENANCE_MODE` | `"true"` puts the site in maintenance (set via the package.json scripts above) |

## Project layout

```
src/
  app/                 # Next.js App Router (pages + /api routes)
  components/          # React components
  lib/
    prisma.ts          # Prisma client (D1 adapter, per-request)
    db.ts              # Raw SQL helpers (SQLite-flavored, ? placeholders)
    auth.ts            # getCurrentUser() / Clerk integration
    storage.ts         # R2 service (server)
    upload-client.ts   # R2 service (browser)
    resend.ts          # Email templates + send
    services/          # Service layer — see CLAUDE.md import-lockdown note
    mcp/               # MCP tool definitions
prisma/schema.prisma   # Single source of truth (SQLite provider)
migrations/            # D1 migrations (wrangler-managed)
scripts/               # tsx + mjs scripts (D1 gen, seeds, one-offs)
cli/                   # Standalone TypeScript CLI that wraps the MCP server
docs/                  # Topic docs (auth, biome backlog, slide gen, etc.)
mcp-ui/                # MCP UI assets bundled by scripts/build-mcp-ui.mjs
wrangler.jsonc         # Cloudflare Worker config (production + staging)
biome.json             # Lint/format config (primary)
eslint.config.mjs      # Slim Next-only ESLint config + import lockdown
```

## Further reading

- `CLAUDE.md` — gotchas, conventions, and import-lockdown rules agents need to follow
- `docs/auth.md` — Clerk configuration, Worker secrets, dashboards
- `docs/biome-strict-backlog.md` — outstanding `warn`-level rules to ratchet to `error`
- `docs/slide-generator-gap-analysis.md` — slide generator scope + caveats
- `SECURITY.md` — security audit and current remediation status
- `cli/README.md` — `ccau` CLI usage

## License

Copyright (C) 2026 Dominik Fretz, Rye Smith, Claude Community Australia

Licensed under the GNU Affero General Public License v3.0 or later
(AGPL-3.0-or-later). See [`LICENSE`](./LICENSE) for the full text.
