# CLAUDE.md

The app lives in `apps/web`. Root `package.json` only delegates scripts there.

## Stack

TanStack Start (Vite) on Cloudflare Workers. Drizzle ORM against per-city D1
(`drizzle-orm/d1`). Clerk via `@clerk/tanstack-react-start`. Lint/format is
oxlint + oxfmt.

## Package manager

**Bun — not npm.** Install in the app with `bun install` from `apps/web`
(committed lockfile is `apps/web/bun.lock`). CI runs
`bun install --frozen-lockfile` there. Use `bunx` in place of `npx`. Prefer
`bun <file>.ts` for one-off TypeScript (Bun runs TS natively).

Root scripts (`bun run dev`, `bun run test`, `bun run check`) are aliases for
`bun --cwd apps/web run …`.

## Database

Two D1 planes:

- `REGISTRY` — tenants, users, memberships, impact lab
- `TENANT_<CITY>` — one database per city

SQL lives in `apps/web/drizzle/registry/` and `apps/web/drizzle/tenant/`.
Access goes through module repositories, never from routes. A module's
repositories are private; other modules go through that module's services.
oxlint enforces this in `apps/web/oxlint.config.ts`.

## Build / dev

From the repo root or `apps/web`:

- `bun run dev` — Vite / TanStack Start at http://localhost:3001
- `bun run check` — oxlint + oxfmt + `tsc --noEmit`
- `bun run test` — vitest
- `bun run deploy:staging` — generate wrangler config, build, deploy staging

Local D1: `gen:wrangler`, `db:migrate:registry:local`, `db:migrate:tenant:local`,
`db:provision:city`, `db:seed:city`. See `apps/web/README.md`.

## Multi-region (AU / NZ)

`VITE_REGION` (`au` default | `nz`) is branding only, not tenant isolation.
Resolve region-varying copy through the Start region helper in
`apps/web/src/shared` — do not hardcode domain, Discord, city, or currency.

## Bindings

Generated `apps/web/wrangler.jsonc` (from `wrangler.template.jsonc` +
`.env.cfinfra` / `.env.local`):

- `REGISTRY` / `TENANT_*` — D1
- `STORAGE` — R2 uploads
- Workflows: `PUBLISH_POST`, `CAMPAIGN_SEND`, `SLIDE_EXPORT`

## Auth

Clerk. Publishable key is `VITE_CLERK_PUBLISHABLE_KEY`. Server secret is
`CLERK_SECRET_KEY`. Public pages load without keys; sign-in needs both plus
`http://localhost:3001` as an allowed origin. See `docs/auth.md`.

## MCP

Streamable HTTP at `/mcp` (and `/api/mcp`). The `cli/` package talks to
`${origin}/mcp`. Uploads use `POST /api/upload/mcp` with the same Bearer token.

## Lint and format

oxlint + oxfmt in `apps/web` (`oxlint.config.ts`, `oxfmt.config.ts`). Run
under Bun (`bun --bun oxlint` / `bun --bun oxfmt`) so TypeScript configs and
`eslint-plugin-crap` load.

- `bun run lint` — oxlint
- `bun run format` — oxfmt in-place (double quotes, semicolons, trailing
  commas, 2-space indent, 100 cols)
- `bun run check` — oxlint + `oxfmt --check` + `tsc --noEmit` (pre-commit)

Intentional exceptions: `// oxlint-disable-next-line <rule> -- <reason>`.

## More

- `apps/web/README.md` — local setup, seed, staging deploy
- `docs/start-cutover.md` — staging smoke + leftover notes
- `docs/auth.md` — Clerk dashboards / secrets
- `docs/email-campaigns.md` — campaign workflow + Resend
- `SECURITY.md` — historical Next/Prisma audit (bannered)

Next/Prisma/OpenNext/Biome files in `docs/` open with a **Historical**
banner. Do not follow those commands.
