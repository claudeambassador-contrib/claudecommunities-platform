# TanStack Start conversion status

Greenfield app lives in [`apps/web`](../apps/web). The root Next.js app remains
the production ship path until [`start-cutover.md`](./start-cutover.md).

| Phase | Status | Notes |
|---|---|---|
| 0 Scaffold | Done | Start + Clerk + CF Vite + Ultracite Biome |
| 1 Data plane | Done | Flattened registry/tenant SQL, TenantStore, iso tests |
| 2 Kernel | Done | Session sync, permissions, R2, maintenance, region |
| 3 Domains | Scaffolded | Module services for events, community, courses, talks, email, social, slides, pages, impact-lab, MCP |
| 4 Worker parity | Scaffolded | Workflows exported from `server.ts`, cron drain, upload/files, staging wrangler env. `PublishPostWorkflow` claims + publishes via Zernio when `ZERNIO_API_KEY` is set (no stub external ids). |
| 5 Routes | In progress | Public city chrome works without Clerk keys. Seeded CMS home, merch embed, Remotion player, membership catalog, event agenda, resources list, email campaign builder, social composer, and slide canvas are on Start. Visual slide export / Next EmailBuilder / native LinkedIn connector remain thinner than Next. |
| 6 Cutover | Prepared | Runbook + ETL stub; **Next not deleted** |

## Start routes (vs Next)

Wired in `apps/web/src/routes` via `createFileRoute` + `createServerFn` + `loadCityPage`.

- **Auth / platform:** `/login`, `/signup`, SSO callbacks, `/pricing`, `/sitemap`, `/offline`, `/remotion` (Remotion player)
- **City public:** events + agenda + resources, CMS `p/$` and city home, courses (enroll + workshop registration URL), speak, my-talks, merch (Shopify Buy Button), cowork, webinars, `/for`, professionals, vibe-coders, cities, membership catalog
- **Community:** members, profiles, search, bookmarks, notifications, connections, leaderboard, learn, posts, settings, guidelines, bug-report
- **Impact Lab:** public, portal, admin, Melbourne event + sponsor
- **City admin:** events, posts, users, roles, badges, tiers, cities, industries, courses, speakers, pages/home CMS, email (list + campaign builder), social (composer + schedule + publish), tools (QR, attendance, slide canvas), invite, import, settings, analytics

Still thinner than Next: full slide-generator canvas/export, Next EmailBuilder block designer, LinkedIn-native social connector, Clerk-backed e2e user (needs keys).

## Local smoke

```bash
cd apps/web
bun install
bun run test
bun run gen:wrangler
# migrate + provision then:
bun run db:seed:city -- sydney --email you@example.com
bun run dev
```

Public pages (`/sydney`, `/sydney/events`, `/login`) load without Clerk keys.
Sign-in and claiming the seeded owner still need `VITE_CLERK_PUBLISHABLE_KEY` +
`CLERK_SECRET_KEY` in `apps/web/.env.local`, plus `http://localhost:3001` as an
allowed origin. Set `E2E_EMAIL` / `E2E_PASSWORD` (and optional `E2E_ADA_*`) to a
real Clerk user for authenticated Playwright walks.
