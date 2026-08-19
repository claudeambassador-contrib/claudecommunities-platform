# @claudecommunities/web

TanStack Start + Drizzle + per-city D1 greenfield app.

There is no production Worker. This package replaces the root Next.js app
once staging smokes (see `docs/start-cutover.md`).

## Stack

- TanStack Start (Vite) on Cloudflare Workers
- Drizzle ORM (`drizzle-orm/d1`)
- Clerk (`@clerk/tanstack-react-start`)
- Ultracite Biome presets
- DDD modules: `schema → repositories → services → routes`

## Isolation

| Binding | Role |
|---|---|
| `REGISTRY` | Tenants, users, memberships, impact lab |
| `TENANT_SYDNEY` / `TENANT_MELBOURNE` / … | One D1 per city |

## Dev

```bash
cd apps/web
bun install
bun run gen:wrangler
bun run db:migrate:registry:local
bun run db:migrate:tenant:local
bun run db:provision:city -- sydney "Sydney"
bunx wrangler d1 execute REGISTRY --local --file=scripts/.provision-sydney.sql
bun run db:seed:city -- sydney --email you@example.com
bun run dev   # http://localhost:3001
```

`db:seed:city` fills the city D1 (spaces, posts, events + agenda, home, cities, courses, speakers, resources, tiers, email, social) and REGISTRY (Ada + optional owner). Sign in with `--email` once — Clerk claims the `invite_` owner row. Omit `--email` for public-page smoke only. `--dry-run` prints SQL without applying.

Public pages load without Clerk keys. Sign-in still needs `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in `.env.local`, plus `http://localhost:3001` as an allowed origin. Playwright walks use `E2E_EMAIL` / `E2E_PASSWORD` against a real Clerk user (Ada is DB-only until those keys exist).

## MCP CLI

The Start Worker serves Streamable HTTP MCP at `/mcp` (and `/api/mcp`). The existing `cli/` package talks to `${origin}/mcp`.

```bash
cd cli
CLAUDECOMMUNITY_CLI_URL=http://localhost:3001 bun src/index.ts login
CLAUDECOMMUNITY_CLI_URL=http://localhost:3001 bun src/index.ts call health
```

Clerk must allow `http://localhost:3001` as an origin. Image uploads from MCP use `POST /api/upload/mcp` with the same Bearer token.

## Staging deploy

There is no production Worker yet. Staging is the only Cloudflare target.

```bash
cd apps/web
bun run gen:wrangler
# Create remote REGISTRY + city D1s if missing, then:
# wrangler d1 migrations apply REGISTRY --remote --env staging
# wrangler d1 migrations apply TENANT_SYDNEY --remote --env staging
# wrangler secret put CLERK_SECRET_KEY --env staging
# wrangler secret put RESEND_API_KEY --env staging
# wrangler secret put RESEND_WEBHOOK_SECRET --env staging
# wrangler secret put ZERNIO_API_KEY --env staging
bun run deploy:staging
```

Smoke: sign in, send one campaign, `ccau --server https://<staging> call health`, upload, schedule a social post.

## Layout

```
src/routes/          # thin TanStack file routes
src/modules/*/       # schema, repositories, services
src/shared/          # db, auth, http, middleware, storage, region
src/workflows/       # PublishPost, SlideExport, CampaignSend
drizzle/registry/    # flattened control-plane SQL
drizzle/tenant/      # flattened city SQL (applied to every city D1)
```
