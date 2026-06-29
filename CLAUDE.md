# CLAUDE.md

## Database

Cloudflare D1 (SQLite). Two access layers:

- `src/lib/prisma.ts` — Prisma client via `PrismaD1` adapter from
  `@prisma/adapter-d1`, resolved per-request through `getCloudflareContext().env.DB`.
  Use this for most data access: `import prisma from '@/lib/prisma'`.
- `src/lib/db.ts` — Raw-SQL helpers (`query`, `queryOne`, `run`) that
  call D1's `prepare().bind().all()`. **SQL must be SQLite-flavored** with
  `?` placeholders (no `$N`, no `ILIKE`, no `NOW()`).

## Schema and migrations

- Single schema at `prisma/schema.prisma` (SQLite provider).
- D1 migrations live in `migrations/` and are applied via wrangler:
  - `bun run d1:generate` — incremental diff against `migrations/.last-schema.prisma`
  - `bun run local:d1:migrate` / `staging:d1:migrate` / `production:d1:migrate`

## Package manager

**This project uses [Bun](https://bun.com) — not npm.** Install deps with
`bun install` and run scripts with `bun run <script>`. The committed lockfile
is `bun.lock` (there is no `package-lock.json`); CI installs with
`bun install --frozen-lockfile`, so commit `bun.lock` whenever dependencies
change. `mcp-ui/` is a sub-package with its own `bun.lock`. Use `bunx` in
place of `npx`. When invoking a one-off TypeScript file, prefer `bun
<file>.ts` (Bun runs TS natively — no `tsx` needed). Dependency postinstall
scripts that need to run (`@clerk/shared`, `protobufjs`) are listed under
`trustedDependencies` in `package.json`; add to that list if a new dependency
needs its lifecycle scripts. Note: `node scripts/*.mjs` calls in the
package.json scripts stay on `node` — those are runtime invocations, not
package-manager commands.

## Build / dev

- Local dev: `bun run dev` (sets `DEPLOY_TARGET=cloudflare`, generates the
  D1-compatible Prisma client, then `next dev`).
- Preview the Worker bundle: `bun run preview`.
- Deploy: `bun run staging:deploy` / `production:deploy`.

## Multi-region (AU / NZ)

One codebase serves two regions, selected by `NEXT_PUBLIC_REGION` (`au` default
| `nz`), inlined at build.

- **`src/lib/region.ts` is the source of truth** — `getRegionConfig()` plus
  helpers (`siteUrl()`, `discordInvite()`, `majorCitiesPhrase()`, …). Never
  hardcode a region-varying value (domain, Discord, city, image, email,
  currency, copy); resolve it here. AU may appear on NZ only as a named partner.
- Region-gate per-region content: AU-only pages `notFound()` when
  `REGION !== "au"`, `merchEnabled` toggles merch, `src/lib/cities.ts` filters
  cities by region. Public marketing routes must be in the `src/middleware.ts`
  allowlists or they get auth-gated.
- **Deploys** use separate wrangler envs + Cloudflare accounts per region:
  `nz:staging:deploy` / `nz:production:deploy` (AU is the bare `staging:deploy` /
  `production:deploy`). NZ secrets/URLs live in `.env.nz.staging` / `.env.nz.prod`.

## Bindings (wrangler.jsonc)

- `DB` — D1 database `claudecommunity-db`
- `STORAGE` — R2 bucket `claudecommunity-uploads`
- `BROWSER` — Cloudflare Browser Rendering, used by `slideRender.ts` /
  `slideExport.ts` for PNG export. URLs are HMAC-signed; needs the
  `RENDER_SIGNING_SECRET` worker secret.

## Auth

Clerk via `@clerk/nextjs`. `src/middleware.ts` is the default-export
`clerkMiddleware`. Server-side, fetch the current user with
`getCurrentUser()` from `src/lib/auth.ts`. **Note: `getCurrentUser()` does
not currently filter out banned users — callers must check `user.isBanned`
where it matters.** See `docs/auth.md` for Clerk dashboards / instance IDs
and `SECURITY.md` #2 for the open ban-check issue.

## Permissions and the `<Can>` component

The role/permission system is defined in `src/lib/permissions.ts` (typed
`Permission` union, ~35 perms across 11 sections). The admin UI gates
**every action-bearing element** (create / edit / delete / publish / sync
buttons, action menus, action-only icon clusters) so users only see what
they can actually do. **Server-side enforcement still happens at the API /
service layer** — UI gating is for UX, not security.

- Server side: use `hasPermission(user, "perm.name")` from
  `@/lib/permissions` against a user fetched via
  `getCurrentUserWithPermissions()`. Page-level access goes through
  `redirect("/admin?error=unauthorized")` when the view-permission is
  missing.
- Client side: use the `<Can>` component from `@/components/admin/Can`.
  It reads permissions from `PermissionsProvider` (wired in `AdminShell`),
  so it works in any descendant — server pages or client components.

```tsx
// In any admin page (server or client) under AdminShell:
<Can permission="courses.edit">
  <Link href="/admin/courses/new">New Course</Link>
</Can>

// Multiple perms required (AND):
<Can permission={["events.edit", "events.delete"]}>...</Can>

// With a fallback when the perm is missing:
<Can permission="email.send" fallback={<span>Read-only</span>}>
  <SendButton />
</Can>
```

Also exposed: `useCan()` returns a check function for inline conditional
logic, and `usePermissionsSet()` returns the raw `Set<Permission>`.

When adding a new admin action button, the question is **which permission
it requires**. If a section's button has no corresponding permission yet,
add one to the `PERMISSIONS` registry first.

## MCP server

Mounted at `/api/mcp`. Tool definitions live in `src/lib/mcp/tools.ts`; tools
authenticate via the Clerk JWT (`extra.userId`) and look the user up in D1.
A standalone CLI lives in `cli/` and is the customer-facing wrapper.

## Maintenance kill-switch

`src/middleware.ts` short-circuits to a 503 page when `MAINTENANCE_MODE` is
set as a Worker secret. Toggle via the package.json scripts (`production:maintenance:on`
/ `:off`) — no redeploy. A `?bypass=<token>` query param lets admins reach
the site while it's down (commit `e22302e`).

## Env files

Use `.env.local` (dev), `.env.staging`, `.env.prod`. **Never** `.dev.vars` —
that path is outdated. For Worker-side secrets, `wrangler secret put <NAME>
--env <staging|production>`. See `.env.example` for the full key list.

## File storage

R2 bucket `STORAGE`, accessed through two service modules — do not call R2
or `fetch('/api/upload')` directly.

- `src/lib/storage.ts` — **server-side** service. All R2 access goes
  through `putFile` / `putDataUrl` / `putBytes` / `putFromUrl` / `getObject` /
  `deleteObject`. Use `putFromUrl(url, opts)` when mirroring a remote image
  into R2 (don't inline `fetch + putBytes`). Use `isStorageUrl(url)` to
  validate user-supplied URLs and `publicUrl(key)` to build the
  `/api/files/<key>` form. Throws `StorageError` with an HTTP status.
- `src/lib/upload-client.ts` — **browser** service. All client uploads go
  via `uploadFile(file, { folder, onProgress })`, which POSTs to
  `/api/upload`. Use `resizeImage(file, maxEdge)` before upload when the
  source can be huge (avatar/cover photos).

Upload endpoints (`/api/upload`, `/api/upload/mcp`) must share the same
gating: `rateLimit({ key: 'upload', limit: 20, windowMs: 60_000 })` and an
`isStorageConfigured()` 503 preflight. Add both to any new upload route.

### Rendering images (no raw `<img>`)

`performance/noImgElement` is at `error`. Don't write a raw `<img>` — the only
three files allowed to are the wrapper components below, which centralize the
suppression. Pick by use case:

- `Avatar` (`@/components/ui/Avatar`) — user/member/author/speaker avatars. Renders
  the image or a gradient initial fallback. `className` = shared shape (both
  branches), `imgClassName` = image-only extras (e.g. a ring), `fallbackClassName`
  = the fallback's gradient/text, `alt` = explicit alt (defaults to `name`).
- `RemoteImage` (`@/components/ui/RemoteImage`) — arbitrary remote/content images
  (event covers, link previews, thumbnails) whose hosts aren't in `next/image`
  `remotePatterns`. Thin pass-through.
- `SlideImage` (`@/components/slide-generator/SlideImage`) — slide / html-to-image
  PNG-export images. `forwardRef`, defaults `crossOrigin="anonymous"`.

Use `next/image` for first-party assets with known dimensions on configured hosts.

## Chat

Chat lives on Discord — there is no in-app chat subsystem.

## Social posting

Posting to LinkedIn (and future destinations) lives under `src/lib/social/`.
Two layered concepts:

- **Platform** = destination network (`linkedin`, future: more).
- **Connector** = integration we use to reach a platform. Today: `linkedin`
  (direct OAuth + LinkedIn REST API, needs Community Management API approval)
  and `zernio` (post via zernio.com using a Zernio API key — no LinkedIn
  approval needed because Zernio's app is already approved).

Adding a connector = drop a folder under `providers/<id>/`, register it in
`providers/registry.ts`, add the id to `ConnectorId` in `types.ts`. The
registry is keyed by connector id, not platform, so multiple connectors
can target the same platform. Each provider declares its `connectKind`
(`"oauth"` or `"api_key"`) and the services route to the right connect
flow based on that.

- Service layer: `src/lib/services/socialAccounts.ts` (OAuth + token refresh)
  and `socialPosts.ts` (CRUD + publish). API routes and MCP tools both go
  through these — no direct LinkedIn calls outside the provider.
- Admin UI: `/admin/social` (scheduler) and `/admin/social/settings`
  (account connect/disconnect). Composer lives in
  `src/components/admin/social/PostComposer.tsx`.
- Cron: internal Cloudflare cron trigger fires the Worker's `scheduled()`
  handler every 15 minutes (see `wrangler.jsonc` → `triggers.crons` and
  `src/worker-scheduled.ts`, wired into the OpenNext bundle by
  `scripts/inject-workflow-exports.mjs`). Drains `status="scheduled"`
  posts whose `scheduledAt` is due **and have no `externalId`** — each
  kicks off a PublishPostWorkflow instance — resets rows stuck in
  `publishing` past the 30-minute safety threshold, and reconciles
  delegated posts (see below) to `published` once their time passes.
  No external pinger.
- Native connector scheduling: connectors that declare
  `supportsNativeScheduling` (Zernio) get scheduled posts handed off
  **immediately** with `scheduledFor` set, so the connector fires them at
  the exact minute instead of waiting for our ~15-min cron. The workflow
  finalizes such a row back to `status="scheduled"` with an `externalId`
  stamped — that `externalId` both excludes it from the cron drain (no
  double-post) and marks it for reconciliation. Connectors without native
  scheduling (LinkedIn direct) still rely on the cron. Local-dev caveat:
  the immediate handoff is gated on the `PUBLISH_POST` binding, so in
  `wrangler dev` scheduled posts just wait for the cron path as before.
  Managing a delegated post stays in sync via the provider's optional
  `updateRemote`/`deleteRemote` (Zernio's `PUT`/`DELETE /posts/{id}`):
  `deletePost` cancels it on Zernio before dropping the local row
  (remote-first — a failed remote delete keeps the row so it isn't
  orphaned), and `updatePost` propagates content/schedule edits. Media
  changes and un-scheduling (status → draft/cancelled) on a delegated post
  are rejected — delete and recreate instead (Zernio refunds the quota).
- Publishing: `src/workflows/publish-post.ts` (binding `PUBLISH_POST`,
  class `PublishPostWorkflow`) runs the actual publish in checkpointed
  steps (claim → prepare → publish-with-retry → finalize). Service
  layer just kicks the workflow off; the workflow writes the terminal
  status. This makes the publish path durable against Worker death
  mid-call — which previously left rows stuck in "publishing".
  - Local dev caveat: workflows aren't available in `wrangler dev`;
    publish actions throw with a clear message and roll the claim back.
  - When adding more workflows, also update
    `scripts/inject-workflow-exports.mjs` so the OpenNext-built
    `worker.js` exports the workflow class.
- LinkedIn prerequisites: developer.linkedin.com app with
  **Community Management API** access (Dev tier is enough to start),
  scopes `w_organization_social`, `r_organization_social`,
  `rw_organization_admin`, redirect URI
  `{NEXT_PUBLIC_APP_URL}/api/admin/social/accounts/linkedin/callback`.
  Set `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
  `SOCIAL_OAUTH_STATE_SECRET` as Worker secrets.
- Organic LinkedIn carousels (swipeable cards) are PDF document posts —
  the `content.media` API "Carousel" type is sponsored-only. Use
  `mediaType: "document"` for carousels and `mediaType: "multi_image"`
  for non-swipeable image grids.

## Lint and format

Biome owns lint + format + import organization for `src/**` and `scripts/**`.
ESLint runs **only** Next.js-specific rules and the infra import lockdown.

- `bun run lint` — Biome + slim ESLint (~2s warm). The single source of truth.
- `bun run format` — Biome formatter, in-place. Style is `quoteStyle: "double"`,
  `semicolons: "always"`, `trailingCommas: "all"`, 2-space indent, 100 cols.
- `bun run check` — the full clean-codebase gate: `biome check .` (lint +
  format + organize-imports) **plus** `lint:next` (ESLint) **plus**
  `typecheck` (`tsc --noEmit`). This is what the pre-commit hook runs.
- `bun run check:fix` — `biome check --write .` (auto-fixes the Biome part).
- `bun run typecheck` — `tsc --noEmit` on its own.
- Config: `biome.json` (Biome) and `eslint.config.mjs` (Next plugin + lockdown).

The codebase is at **zero lint warnings**: every Biome rule is at `"error"`
(no `"warn"` rules remain except the `noConsole` allowlist for
`console.warn`/`console.error`). Intentional exceptions are justified
inline with `// biome-ignore <rule>: <reason>` (and a file-level
`/* eslint-disable @next/next/no-img-element */` where a raw `<img>` is
required, e.g. slide/canvas export). Keep it clean: prefer a real fix; add a
suppression only for a genuinely-intentional case with a concrete reason.

A **cross-platform pre-commit hook** (`.githooks/pre-commit`, wired via the
`prepare` script's `git config core.hooksPath .githooks`) runs `bun run
check` before every commit. Bypass in a pinch with `git commit --no-verify`.

`biome check --write --unsafe` is known to break types on this repo (TDZ via
`useExhaustiveDependencies` auto-fixes). Prefer safe-only `--write`. If you
use `--unsafe`, run `bunx tsc --noEmit` immediately after.

The format-pass commit `ac56e3f` is listed in `.git-blame-ignore-revs` —
`git blame` and GitHub will skip it automatically.

The ESLint import lockdown (`no-restricted-imports`) blocks API routes and
MCP tools from importing `@/lib/prisma`, `@/lib/db`, `@/lib/storage`,
`@/lib/notifications` directly — go through `src/lib/services/*`. Pre-existing
violations are listed in `PENDING_SERVICE_MIGRATION` in `eslint.config.mjs`;
remove an entry as each file is migrated to a service.

## More

- `README.md` — user-facing overview, dev setup, deploy commands
- `docs/multi-tenancy-setup.md` — from-scratch runbook: local dev, Cloudflare
  deploy, tenant provisioning, first-admin bootstrap, routing-knob env vars
- `docs/auth.md` — Clerk config, Worker secrets, dashboards
- `docs/biome-strict-backlog.md` — historical: the warn→error ratchet, now
  fully landed (all rules at `error`, zero warnings)
- `docs/cleanup-backlog.md` — structural cleanups still owed (service-layer
  migration, route auth consolidation, composer dedup)
- `docs/slide-generator-gap-analysis.md` — slide-generator scope + caveats
- `docs/email-campaigns.md` — `CampaignSendWorkflow` architecture, failure
  handling, log vocabulary, deploy + secret notes
- `docs/deploy-r2-cache-patch.md` — why `@opennextjs/cloudflare` is patched to
  make remote R2 cache-population non-fatal (Cloudflare-side "Premature close"
  on the bucket check); how it self-heals and when to remove it
- `SECURITY.md` — security audit + current remediation status
