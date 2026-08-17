# TanStack Start cutover runbook

This document is **Phase 5**. Do not execute production cutover until
`apps/web` has staging feature parity (Phases 0–4) and stakeholders sign off.

## Preconditions

- [ ] Early staging (`claudecommunities-start-staging`) has REGISTRY + city D1s
- [ ] Isolation tests green (`bun run test:iso` in `apps/web`)
- [ ] Clerk keys configured for the Start Worker
- [ ] R2 `STORAGE`, Browser Rendering, Workflows, cron verified on staging
- [ ] Decision on ETL: migrate historical events/members **or** clean-slate launch

## Optional ETL (shared D1 → per-city D1)

The legacy app uses one shared D1 with `tenantId` columns. Script stub:

```bash
bun apps/web/scripts/etl-from-legacy.mjs --tenant sydney --legacy-db <id>
```

Export rows where `tenantId = 'sydney'` (or the legacy slug) into the city D1.
Registry users/memberships are rebuilt from Clerk + `UserTenant`.

## Dual-run checklist

1. Deploy Start Worker beside Next (separate worker name — already the case).
2. Point a staging hostname at Start; keep production on Next.
3. Verify: auth, city home, events, community, admin, MCP, upload, cron drain.
4. Freeze flattened schema — additive migrations only after this point.

## Production DNS cutover (per region)

1. `bun run deploy:staging` smoke OK.
2. Create production REGISTRY + city D1s; apply `drizzle/registry` + `drizzle/tenant`.
3. Put secrets: Clerk, maintenance, LinkedIn/Zernio, Resend/Send16, render signing.
4. Switch DNS / Workers routes from OpenNext worker → Start worker.
5. Monitor `wrangler tail` for 30–60 minutes.

## Retire Next / Prisma / OpenNext

Only after production is stable on Start:

```bash
# Remove after cutover is confirmed (destructive):
# - prisma/, migrations/ (legacy), open-next.config.ts
# - @opennextjs/cloudflare, next, @prisma/*, @clerk/nextjs
# - scripts/inject-workflow-exports.mjs, patches/opennext*
# - src/app, src/middleware.ts (Next), eslint.config.mjs Next lockdown
# - Move Ultracite biome config to repo root; apps/web becomes the app
```

Until then, **keep the root Next app shipping**.

## Rollback

Re-point DNS/routes to the previous OpenNext worker. City D1s and REGISTRY are
independent — rolling back the Worker does not require dropping new D1s.
