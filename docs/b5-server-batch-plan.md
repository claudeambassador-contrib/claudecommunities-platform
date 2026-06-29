# B5 server batch — region.ts → getTenantConfig() (execution plan)

Status tracker for the B5 server-side migration (the 67 server importers of
`@/lib/region`). Client files (40) are done. `tsc --noEmit` is the green gate
(clean baseline 0 errors); the app build is RED only for runtime/routing
reasons (B6), not types. Each migrated file must keep tsc at 0 + iso at 99.

## The two non-mechanical risks (tsc/iso do NOT catch these)

1. **`siteUrl` ≡ `appUrl` are byte-identical on au** (`https://claudecommunity.com.au`).
   A wrong-field swap is invisible on the only live tenant. RULE: preserve the
   EXACT original accessor per call site — `siteUrl()`→`.siteUrl`,
   `appUrl()`→`.appUrl`. Audit old-symbol→new-field per site, not "does it render".
2. **sync→async changes the failure mode to fail-closed THROW** when no tenant is
   in scope (`getTenantConfig`→`getTenantId` throws). Only migrate a file where a
   tenant is guaranteed in scope (middleware header for request paths, or
   `runWithTenant` for off-request). This is why the split below is on
   scope-risk, not size.

## Buckets

### A. Email cluster — INLINE (me), one atomic commit
`lib/email/wrap.ts`, `lib/email/blocks.ts` (client-shared → stay sync, take
config fields as params), `lib/resend.ts` (server-only → pure templates take
`config`, `sendEmail`/`sendCampaignEmails` resolve `fromEmail` internally).
Callers updated same commit: `EmailBuilder.tsx`, `EmailPreview.tsx` (client),
`workflows/campaign-send.ts`, `api/admin/email/campaigns/[id]/test/route.ts`,
and the 11 `resend` importers (add `await`). Drop `blocks.ts` module-level
`LOGO_URL`/`BASE_URL` (only `EmailBuilder` consumes them → compute locally).

### MCP audit result (DONE — tools.ts + ui-tools.ts migrated)
`/mcp` is `selfTenanted` in middleware (no header stamp); tools get scope only
from `withMcpService` (`runWithTenant(HOME_TENANT)`). But MANY handlers are
**bare `async`** (getEvents, getCourses, getUserProfile, createEvent,
updateCourse, listUsers, listSocialPosts, …) — NOT wrapped — so their
`getDbUser`→`getActorPermissions` runs unscoped (the pre-existing "MCP
membership gap"). The B5 fix sidesteps this: `mcpBaseUrl()` /
`getOriginFromEnv()` establish their OWN `runWithTenant(HOME_TENANT)` scope
(nestable → no-op inside wrapped handlers, self-sufficient in bare ones), so the
URL resolution is correct regardless. **TODO B6/B7**: wrap ALL MCP handlers in
`withMcpService` (or scope the whole tool execution in the route) so
`getActorPermissions`/`getPrisma` in the bare handlers are properly scoped too.

### B. Scope-audit — INLINE (me) [NOT fan-out — needs a scope check per file]
- `lib/mcp/tools.ts` (huge + 25× `BASE_URL=appUrl()`) + `lib/mcp/ui-tools.ts`
  — **VERIFY `/api/mcp` stamps a tenant** before migrating, or every tool throws
  (the known "MCP membership gap" — migrating this file triggers it).
- `api/cron/send-scheduled/route.ts`, `api/cron/process-automations/route.ts`
  — cron: confirm `runWithTenant` wraps the work before the now-async read fires.
- `app/internal/slide-render/[...]/page.tsx`, `lib/services/slideRender.ts`
  — signed-URL path (B7-adjacent); appUrl in the HMAC surface.
- `lib/digest.ts`, `lib/notifications.ts`, `lib/auth.ts`, services that send mail.

### C. Fan-out — request-scoped, safe (workflow, chunked ≤5)
`api/admin/email/{settings,templates,generate-blocks,generate-subjects,generate-template}/route.ts`,
`api/admin/email/campaigns/[id]/{send,resume}/route.ts`, `api/bug-report/route.ts`,
`api/email/track/click/[sendId]/[url]/route.ts` (host-scoped),
FORCE-DYN pages: `cities/[slug]`, `courses/[slug]`, `events/[slug]`,
`community/learn`, `community/profile/[id]`, `my-talks/page`, `my-talks/[id]`,
`sitemap.xml/route.ts`; `admin/events/{agendaToDescription,emailBlasts,eventFormHelpers}.ts`;
request-path services: `claudience`, `comments`, `eventLumaInterest`, `events`,
`impactLab`, `posts`, `talks`, `_slug` (all already async).

### D. DEFER to B6 (static-gen public pages — would throw at build)
homepage `page.tsx`, `events/page`, `events/claude-impact-lab-melbourne/*`,
`courses/page`, `for/page`, `for/[slug]`, `resources/page`, `resources/[slug]`,
`webinars/claude-code-webinar-australia`, `professionals`, `vibe-coders`,
`speak`, `merch`, `cowork`, `community/guidelines`, `manifest.ts`, `robots.ts`,
`sitemap/page.tsx`, `.well-known/security.txt`. These migrate as part of the
`/t/[tenant]` restructure that forces them dynamic. Correct on au via region.ts
residual until then.

### E. DEFER to tenant #2 (build-time static data — region.ts stays as residual)
`lib/cities.ts`, `lib/verticals.ts`, `lib/resources.ts`, `remotion/CommunityPromo.tsx`,
`remotion/WebsiteTour.tsx`, `admin/events/eventFormHelpers.ts` (exported
`TIMEZONE_OPTIONS` const — region-keyed static data; making it tenant-aware ripples
to every event-form importer, deferred until tenant #2). region.ts keeps
`getRegionConfig`/`majorCitiesPhrase`/`REGION`/`ogLocale` for these (and as the seed
source for `scripts/seed-tenant.ts`).

### F. DEFER — cron with no tenant scope (region residual; cron-tenancy = B6/B7)
`api/cron/send-scheduled/route.ts`: `/api/cron/*` is `selfTenanted` in middleware
(fail-closed, no header), so `getTenantConfig()` would throw. Its `appUrl()` is a
build-time home-region URL — exactly right for an unscoped cron — so it KEEPS the
region.ts call. Fixing this needs per-tenant cron iteration (B6/B7), not a config swap.

## DONE this session
- Seed (`scripts/seed-tenant.ts` + test) — commit 2839159.
- A. Email cluster — commit c5323de.
- MCP (tools.ts + ui-tools.ts) — commit 6dccec5.
- Inline scope-sensitive + sync-helper-ripple: `auth.ts` (notifySignup config-param),
  `services/slideRender.ts` (async getRenderOrigin; origin not in the HMAC payload),
  `admin/events/agendaToDescription.ts` + `emailBlasts.ts` (config-param `lang`/`siteUrl`,
  caller `PrepareEventModal.tsx` threads from useTenantConfig).
- C. Services + API routes — workflow fan-out (b5-server-config-migration).
- `components/Footer.tsx` — a MISSED client component. It looks like a server file
  (no `"use client"`) but `ConditionalLayout` (`"use client"`) imports & renders it as
  a sibling of `Navbar`, which already uses `useTenantConfig()`. So it's in the client
  bundle → migrated to `useTenantConfig()` (mirrors Navbar exactly), `discordCommunityInvite()`
  → the `.discordCommunityInvite` field. Cities stay on `lib/cities.ts` (bucket E).
  VERIFIED the runtime invariant tsc/iso can't see (`useTenantConfig()` throws with no
  provider, unlike the old build-static `getRegionConfig()`): (1) `ConditionalLayout` is the
  SOLE real importer of the Footer module; (2) `app/layout.tsx` wraps `ConditionalLayout` in
  `<Providers>`→`<TenantConfigProvider config={…}>` (config resolved server-side in the root
  layout). So the provider is guaranteed above every Footer render.
- `test/resend-templates.test.ts` — closes the advisor's invisible-slip gap: the 6
  branding-heavy `resend.ts` templates (`getNotification/Welcome/Invite/EventReminder/
  LumaLinkReady/CampaignEmailHtml`) had ZERO coverage. The test feeds a config with
  DISTINCT `siteUrl`≠`appUrl` and pins logo→siteUrl, every action link→appUrl. On au
  these are byte-identical so tsc/iso/render can't catch a swap; this can.

## B5 CLOSED — classified inventory of the 38 remaining `@/lib/region` importers
Every remaining importer is a DELIBERATE defer, correct on au via the region.ts residual
(`getRegionConfig`/helpers/`REGION`/`REGION_CONFIGS`). None is a request-scoped non-page
consumer (those were the B5 surface and are all migrated). The split below IS the B6/B7
handoff. Re-derive with `grep -rln "@/lib/region" src`.

**→ B6 (migrate AS the `/t/[tenant]` move forces them dynamic) — 24 pages + 4 metadata routes**
- Pages (force-dynamic + static): `page.tsx` (home), `events/{page,[slug],claude-impact-lab-melbourne/{page,sponsor}}`,
  `courses/{page,[slug]}`, `cities/[slug]`, `for/{page,[slug]}`, `resources/{page,[slug]}`,
  `community/{guidelines,learn,profile/[id]}`, `my-talks/{page,[id]}`, `professionals`,
  `vibe-coders`, `speak`, `merch`, `cowork`, `webinars/claude-code-webinar-australia`, `sitemap/page`.
  RULE (advisor boundary): ALL pages relocate under `/t/[tenant]`; their region→config swap
  happens THERE, not now. Migrating ahead of the move would fail-closed THROW at build (static
  gen has no tenant scope). `generateStaticParams` DB queries are themselves a B6 concern.
- Metadata routes (NOT under `/t/`, host/tenant-stamped like `/api/*`): `manifest.ts`, `robots.ts`,
  `sitemap.xml/route.ts`, `.well-known/security.txt/route.ts`. Deferred to B6 because they're
  build-time-static today AND must become per-tenant-domain aware as part of routing. Middleware
  stamps HOME_TENANT for these (non-selfTenanted platform routes), so they're correct on au now.

**→ B7 (slide-render tenant-binding) — 2**
- `app/internal/slide-render/[…]/page.tsx` + `components/slide-generator/layouts/shared.tsx`
  (`getEventDateText` reads `getRegionConfig().lang` for date locale — sync, cosmetic, used in
  BOTH the client editor and the server PNG render). `/internal` is `selfTenanted` (fail-closed,
  no stamp); its tenant comes from the HMAC-signed URL. Thread `lang` when that signed-URL tenant
  binding lands (named B7 item), not before — the server-render side has no config source until then.

**→ tenant #2 (build-time static data; region.ts stays as the seed source) — 6**
- `lib/cities.ts`, `lib/resources.ts`, `lib/verticals.ts`, `remotion/{CommunityPromo,WebsiteTour}.tsx`,
  `admin/events/eventFormHelpers.ts` (`TIMEZONE_OPTIONS` const — making it tenant-aware ripples to
  every event-form importer). All build-time/region-keyed; no per-request scope to migrate to.

**→ cron per-tenant iteration (B6/B7) — 1**
- `api/cron/send-scheduled/route.ts` — `/api/cron/*` is `selfTenanted` (no stamp); its `appUrl()`
  is a build-time home-region URL, exactly right for an unscoped cron. Real fix = per-tenant cron
  iteration, not a config swap.

**→ region.ts is the SOURCE (never migrates) — 1**
- `middleware.ts` — reads `REGION` to seed tenant resolution. The root of the residual.

## Operational tail (do NOT lose)
The committed seed (`scripts/seed-tenant.ts`) fixes the code, but the live au
site renders placeholder branding until `npm run production:d1:seed-tenant` runs
against prod. Order is load-bearing (FK + config): **migrate → seed-tenant**.
Add to the deploy runbook next to `production:d1:migrate`.
