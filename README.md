# Claude Community platform

TanStack Start + Drizzle app behind [claudecommunity.com.au](https://claudecommunity.com.au) —
events, community feed, courses, member directory, email campaigns, an Impact Lab
hackathon portal, and an MCP server for `claude.ai`.

The app lives in [`apps/web`](./apps/web). `cli/` talks to its MCP endpoint.
`mcp-ui/` is a standalone MCP UI bundle.

## Stack

- **Framework**: TanStack Start (Vite, React 19)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 — `REGISTRY` plus one D1 per city
- **ORM**: Drizzle (`drizzle-orm/d1`)
- **Auth**: Clerk (`@clerk/tanstack-react-start`)
- **Storage**: Cloudflare R2 (`STORAGE`)
- **Email**: Resend
- **MCP**: Streamable HTTP at `/mcp` (CLI in `cli/`)
- **Lint/format**: oxlint + oxfmt

## Quick start

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

From the repo root, `bun run dev` / `bun run test` / `bun run check` are aliases
for the same scripts in `apps/web`.

Public pages load without Clerk keys. Sign-in needs
`VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in `apps/web/.env.local`, plus
`http://localhost:3001` as an allowed origin. See `apps/web/.env.example` and
`docs/auth.md`.

## MCP CLI

```bash
cd cli
CLAUDECOMMUNITY_CLI_URL=http://localhost:3001 bun src/index.ts login
CLAUDECOMMUNITY_CLI_URL=http://localhost:3001 bun src/index.ts call health
```

## Staging

There is no production Worker on this stack yet. Staging is the Cloudflare target.

```bash
bun run deploy:staging
```

See `apps/web/README.md` and `docs/start-cutover.md`.

## Project layout

```
apps/web/              # TanStack Start + Drizzle app
  src/routes/          # thin file routes
  src/modules/         # schema, repositories, services
  src/shared/          # db, auth, http, storage, region
  drizzle/             # registry + per-city SQL
cli/                   # MCP CLI (ccau)
mcp-ui/                # MCP UI bundle
docs/                  # Topic docs
```

## Further reading

- `apps/web/README.md` — local setup, seed, staging deploy
- `CLAUDE.md` — conventions for agents
- `docs/auth.md` — Clerk configuration, Worker secrets, dashboards
- `docs/start-cutover.md` — staging smoke
- `SECURITY.md` — security audit and current remediation status
- `cli/README.md` — `ccau` CLI usage

## License

Copyright (C) 2026 Dominik Fretz, Rye Smith, Claude Community Australia

Licensed under the GNU Affero General Public License v3.0 or later
(AGPL-3.0-or-later). See [`LICENSE`](./LICENSE) for the full text.
