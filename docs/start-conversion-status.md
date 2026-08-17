# TanStack Start conversion status

Greenfield app lives in [`apps/web`](../apps/web). The root Next.js app remains
the production ship path until [`start-cutover.md`](./start-cutover.md).

| Phase | Status | Notes |
|---|---|---|
| 0 Scaffold | Done | Start + Clerk + CF Vite + Ultracite Biome |
| 1 Data plane | Done | Flattened registry/tenant SQL, TenantStore, iso tests |
| 2 Kernel | Done | Session sync, permissions, R2, maintenance, region |
| 3 Domains | Scaffolded | Module services for events, community, courses, talks, email, social, slides, pages, impact-lab, MCP |
| 4 Worker parity | Scaffolded | Workflows exported from `server.ts`, cron drain, upload/files, staging wrangler env |
| 5 Cutover | Prepared | Runbook + ETL stub; **Next not deleted** |

## Local smoke

```bash
cd apps/web
bun install
bun run test
bun run gen:wrangler
# migrate + provision then:
bun run dev
```
