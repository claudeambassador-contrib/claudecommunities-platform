# TanStack Start cutover runbook

There is **no production traffic**. Staging is the only Cloudflare target.
Once Start smokes on staging, delete the root Next/Prisma/OpenNext tree.
Do **not** ETL from the Next shared D1 — Start D1s are clean-slate.

## Preconditions

- [x] Isolation tests green (`bun run test:iso` in `apps/web`)
- [x] Campaign send writes `email_sends` via Resend + `CAMPAIGN_SEND` workflow
- [x] Cron drains due social posts **and** scheduled campaigns
- [x] MCP Streamable HTTP at `/mcp` + `/api/upload/mcp`
- [ ] Staging Worker (`deploy:staging`) has remote REGISTRY + city D1s
- [ ] Clerk, Resend, Zernio, R2 secrets on the Start Worker
- [ ] Smoke: login, send one campaign, MCP `health`, upload, social schedule

## Staging checklist

```bash
cd apps/web
bun run gen:wrangler
# wrangler d1 migrations apply REGISTRY --remote --env staging
# wrangler d1 migrations apply TENANT_SYDNEY --remote --env staging
# wrangler secret put CLERK_SECRET_KEY --env staging
# wrangler secret put RESEND_API_KEY --env staging
# wrangler secret put ZERNIO_API_KEY --env staging
bun run deploy:staging
```

CLI against Start:

```bash
cd cli
CLAUDECOMMUNITY_CLI_URL=http://localhost:3001 bun src/index.ts login
# or --server https://<staging-host>
```

## Retire Next / Prisma / OpenNext

Only after the staging smoke above:

```bash
# Destructive — do not run until Start is the staging Worker:
# - prisma/, migrations/ (legacy), open-next.config.ts
# - @opennextjs/cloudflare, next, @prisma/*, @clerk/nextjs
# - scripts/inject-workflow-exports.mjs, patches/opennext*
# - src/app, src/middleware.ts (Next), eslint.config.mjs Next lockdown
# - Point root package.json dev/test/check at apps/web
```

Keep `cli/` and `mcp-ui/`; they only need the Start origin.
