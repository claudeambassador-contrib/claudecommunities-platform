# @claudecommunities/web

TanStack Start + Drizzle + per-city D1 greenfield app.

The root Next.js app keeps shipping production until cutover (see
`docs/start-cutover.md`). This package is the replacement.

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
bun run dev   # http://localhost:3001
```

Set `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in `.env.local`.

## Layout

```
src/routes/          # thin TanStack file routes
src/modules/*/       # schema, repositories, services
src/shared/          # db, auth, http, middleware, storage, region
src/workflows/       # PublishPost, SlideExport, CampaignSend
drizzle/registry/    # flattened control-plane SQL
drizzle/tenant/      # flattened city SQL (applied to every city D1)
```
