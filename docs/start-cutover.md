# TanStack Start cutover runbook

There is **no production traffic**. Staging is the only Cloudflare target.
The root Next/Prisma/OpenNext tree is gone. Staging is the only Cloudflare
target. Do **not** ETL from any leftover Next shared D1 — Start D1s are
clean-slate.

## Preconditions

- [x] Isolation tests green (`bun run test:iso` in `apps/web`)
- [x] Campaign send writes `email_sends` via Resend + `CAMPAIGN_SEND` workflow
- [x] Cron drains due social posts **and** scheduled campaigns
- [x] MCP Streamable HTTP at `/mcp` + `/api/upload/mcp`
- [x] Staging Worker (`deploy:staging`) has remote REGISTRY + city D1s
- [ ] Clerk, Resend, Zernio, R2 secrets on the Start Worker
- [ ] Smoke: login, send one campaign, MCP `health`, upload, social schedule

Staging Worker (2026-08-21): `claudecommunities-start-staging` at
https://claudecommunities-start-staging.claudecommunityau.workers.dev

Remote D1s (clean-slate, not the old Next `claudecommunity-staging`):

| Binding | Database | id |
| --- | --- | --- |
| `REGISTRY` | `claudecommunity-registry-staging` | `3c23d7b0-951f-485d-b728-af82b1f6c79c` |
| `TENANT_SYDNEY` | `claudecommunity-sydney-staging` | `bf793ef2-1d8d-4a6f-a38b-44459c09ca93` |
| `TENANT_MELBOURNE` | `claudecommunity-melbourne-staging` | `c90ab59c-6dc2-4dcf-aeb4-f2d6f90d2878` |

`STORAGE` reuses existing `claudecommunity-uploads-staging`. Public `/`,
`/sydney`, `/sydney/events`, `/login` return 200. Worker secrets are still
empty — put them on **this** Worker (`--env staging`), not `ccau-staging`.

Vite + Wrangler must see `CLOUDFLARE_ENV=staging` at **build** time or the
deploy flattens to local D1 ids. `bun run deploy:staging` sets that.

## Staging checklist

```bash
cd apps/web
# IDs live in gitignored .env.cfinfra (see .env.cfinfra.example)
bun run gen:wrangler
# wrangler d1 migrations apply REGISTRY --remote --env staging
# wrangler d1 migrations apply TENANT_SYDNEY --remote --env staging
# wrangler secret put CLERK_SECRET_KEY --env staging
# wrangler secret put VITE_CLERK_PUBLISHABLE_KEY --env staging
# wrangler secret put RESEND_API_KEY --env staging
# wrangler secret put RESEND_WEBHOOK_SECRET --env staging
# wrangler secret put RENDER_SIGNING_SECRET --env staging
# wrangler secret put ZERNIO_API_KEY --env staging
CLOUDFLARE_ACCOUNT_ID=… bun run deploy:staging
```

CLI against Start:

```bash
cd cli
CLAUDECOMMUNITY_CLI_URL=http://localhost:3001 bun src/index.ts login
# or --server https://<staging-host>
```

## Retired

Root Next.js, Prisma, OpenNext, legacy `src/`, `prisma/`, `migrations/`, and
the Next ESLint lockdown are gone. Root `package.json` delegates to `apps/web`.
Keep `cli/` and `mcp-ui/`; they only need the Start origin.
