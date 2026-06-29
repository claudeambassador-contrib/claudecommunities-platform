import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

// Lockdown: API routes and MCP tools must access DB / storage / notifications
// only through src/lib/services/*. The paths listed below are pre-existing
// violations that have not yet been migrated to a service (admin/email/*,
// cron/*, etc.). As each file is refactored to a thin service adapter, remove
// its entry; the rule will then block any regression.
// Note: literal `[id]` segments in App Router paths are character classes in
// glob syntax, so we list them with escaped brackets (`\\[id\\]`) instead of
// relying on `**` to step through them.
const PENDING_SERVICE_MIGRATION = [
  "src/app/api/admin/email/**",
  "src/app/api/admin/events/\\[id\\]/resources/route.ts",
  "src/app/api/admin/events/\\[id\\]/resources/\\[rid\\]/route.ts",
  "src/app/api/admin/events/\\[id\\]/rsvps/route.ts",
  "src/app/api/admin/events/luma-sync/**",
  "src/app/api/admin/import/**",
  "src/app/api/admin/invite/**",
  "src/app/api/admin/sync-users/**",
  "src/app/api/courses/progress/**",
  "src/app/api/cron/**",
  "src/app/api/email/track/**",
  "src/app/api/email/unsubscribe/**",
  "src/app/api/events/\\[id\\]/resources/route.ts",
  "src/app/api/impact-lab-interest/**",
  "src/app/api/impact-lab-sponsor/**",
  "src/app/api/webhooks/**",
];

// Tenant-isolation ratchet. The default export of `@/lib/prisma` is the
// UNSCOPED client — it reads/writes every tenant's rows. Multi-tenancy
// (Option A) routes all request-context data access through `getPrisma()`
// (auto-injects the current tenantId at the $extends chokepoint), global
// registry/Impact-Lab data through `getPlatformPrisma()`, and cron/workflow
// code through `runWithTenant(tenantId, fn)`. Any file still importing the
// default `prisma` is a silent cross-tenant leak the moment a second tenant
// exists. The list below is the remaining migration backlog — grouped by
// execution context so each entry's fix is unambiguous. Remove an entry as
// the file is migrated; the rule then blocks regressions. Completion of the
// fan-out = this list is empty. (API routes are NOT here: they're governed by
// the stricter route→service lockdown via PENDING_SERVICE_MIGRATION below.)
const PENDING_TENANT_SCOPE = [
  // --- Request-context App Router pages. Fix: `await getPrisma()` (middleware
  //     stamps x-tenant-id — incl. HOME_TENANT on the apex, defect #3). 13 clean
  //     pages migrated 2026-06-16 (admin/courses, admin/tiers, courses,
  //     courses/[slug], pricing, community/{events,layout,learn,posts/[id],
  //     settings/profile}, events, events/[slug], events/[slug]/resources).
  //     The 6 GLOBAL-`User`-listing pages (admin, admin/analytics, cities/[slug],
  //     community/{leaderboard,profile/[id],search}) were migrated 2026-06-16 with
  //     the membership join `where:{ tenantMemberships:{ some:{ tenantId } } }` PLUS
  //     an explicit `tenantId` on every scoped relation reached THROUGH the global
  //     User (filtered `_count`, `userBadges`, `subscriptions`, `posts` — the
  //     chokepoint does not re-filter includes that traverse a global model), and
  //     profile/[id]'s `cached()` is now tenant-keyed (cache.ts §3). All clear.
  // --- Request-context services. Fix: `getPrisma()`. (Migrated 2026-06-16 and
  //     removed from this list: activity, badges, claudience, connections,
  //     eventAgenda, notifications, polls, scheduled-courses, talkComments,
  //     _slug — all verified untainted by the revdep scan + tsc + iso suite.)
  // comments.ts + posts.ts migrated 2026-06-16 as combined units: writes →
  // getPrisma(), and the raw `@/lib/db` reads (listForPost / listFeed / getPost /
  // listBookmarkedFeed) rewritten to scoped getPrisma() findMany so they inherit
  // the chokepoint. The author-badge fan-out (UserBadge by global authorId) is
  // now tenant-scoped, closing that cross-tenant include leak. Off both lists.
  // --- Workflow/cron-REACHABLE services (VERIFIED via revdep scan from the 3
  //     workflows + 2 cron routes). `getPrisma()` THROWS here (no request) — the
  //     fix is runWithTenant(tenantId, …) at the entry point or an explicit
  //     tenantId arg, NOT a bare getPrisma() swap. NOTE: socialAccounts/
  //     slideRender/slideGenerator were swapped to getPrisma() in an earlier
  //     batch and WILL throw from these paths until the workflows/crons wrap
  //     their calls in runWithTenant — tracked in docs/multi-tenancy-fanout-plan.md.
  //     socialPosts.ts migrated 2026-06-16 (B3a): CRUD → getPrisma() (request);
  //     the cron drain (resetStuckPublishing/publishDueScheduled/
  //     reconcileDelegatedScheduled) reads cross-tenant via getPlatformPrisma()
  //     then publishes each due post under runWithTenant(row.tenantId);
  //     kickoffPublishWorkflow stamps tenantId into the PublishPostParams payload.
  //     speakers/talks/slideRenderInvalidation migrated 2026-06-16 (B3b): scoped
  //     models → getPrisma() (resolves in request OR the workflow runWithTenant
  //     their callers establish). talks.ts's admin-notification (global User by
  //     role) now joins tenantMemberships so a submission only emails THIS
  //     tenant's admins, not every community's.
  // --- Platform/global plane: cross-tenant User listings + global models.
  //     Fix: `getPlatformPrisma()` (and a tenantMemberships join for User lists).
  //     Impact Lab (admin/page/portal pages + impactLab.ts) migrated 2026-06-16 →
  //     getPlatformPrisma(): all 11 ImpactLab* models are GLOBAL (a self-contained
  //     event portal), so the unscoped platform client is the deliberate choice.
  // users.ts migrated 2026-06-16: member lists/counts/profile → getPrisma() +
  // membership join + filtered _count/userBadges (listUsers, listMembers,
  // listConnectionMembers, getMemberTabCounts, getMemberCount, searchUsers,
  // getProfile, listAllAdmin, listNamesAdmin, setBanned target); global identity/
  // presence/prefs (updateProfile, updateTagline, email prefs, lastSeen,
  // onlineUserIds, onboarding, *ByClerkId) → getPlatformPrisma().
  // --- Mixed/infra lib (scope depends on caller). (auth.ts migrated 2026-06-16:
  //     resolveSessionUser → getPlatformPrisma; isAdmin + getCurrentUserWithPermissions
  //     → membership-based getActorPermissions, the privilege-escalation fix.
  //     clerk-roles → getPlatformPrisma (User.role is the global Clerk mirror);
  //     notifications → getPrisma for Notification (scoped) + getPlatformPrisma for
  //     User/EmailPreference (global), request-context only. Both 2026-06-16.)
  //     digest migrated 2026-06-16 (B3c): the weekly-digest cron now LOOPS
  //     active tenants under runWithTenant(slug) — each community sends its own
  //     digest to its members (membership join) of its own content (scoped
  //     getPrisma). The "new members" stat moved from a global user.count to a
  //     scoped userTenant.count (was a cross-tenant stat leak). EmailPreference
  //     stays on getPlatformPrisma (global-per-user, userId @unique).
  // --- Workflow/cron entry points migrated 2026-06-16 (all OFF this list).
  //     The pattern: payload carries tenantId; run() re-enters
  //     runWithTenant(payload.tenantId) inside EVERY step.do (ALS doesn't
  //     survive step boundaries, same as runWithEnv); the dispatcher (request
  //     context) stamps the tenant.
  //     - slide-export (B3): all-scoped (SlideExportJob / SlideGeneratorState /
  //       Speaker / SlideRender).
  //     - publish-post (B3a, with socialPosts): SocialPost / SocialAccount.
  //     - campaign-send (B3c): closed the global-User segment leak —
  //       queryRecipients now joins tenantMemberships so a campaign only emails
  //       THIS tenant's users (User is global; the chokepoint can't auto-scope
  //       it). EmailCampaign/EmailSend → getPrisma; EmailSuppressionList/User →
  //       getPlatformPrisma; the EmailSend createMany uses the audited B2.1
  //       escape (platform client + explicit tenantId, campaignId pre-validated
  //       in-tenant). Both dispatch routes (send/resume) stamp getTenantId().
];

// Second tenant-isolation surface (the spec §2 caveat the default-import ratchet
// can't see): raw `@/lib/db` (`query`/`queryOne`/`run`) issues SQLite that does
// NOT pass through the tenantScope chokepoint, so each statement must filter
// tenantId in its WHERE by hand — or be moved to a scoped getPrisma() call.
// ✅ EMPTY 2026-06-16: all three original raw-SQL callers were migrated to
// scoped getPrisma() reads (comments.listForPost, posts.{listFeed,getPost,
// listBookmarkedFeed}, community/members getConnections) so they inherit the
// chokepoint. The raw-`@/lib/db` ban below now applies repo-wide with no
// exemptions — any NEW raw query is a hard error unless added back here with a
// hand-audited `AND tenantId = ?` on every statement.
const PENDING_RAW_SQL_TENANT_AUDIT = [];

// The restricted-import descriptor for the ratchet: ban the DEFAULT import of
// the prisma module (the unscoped client; named getPrisma/getPlatformPrisma/
// withTenant stay allowed) AND any import of the raw-SQL `@/lib/db` module
// (chokepoint-bypassing). Folded into ONE rule on ONE file set so the two bans
// can't override each other (ESLint flat-config keeps only the last
// `no-restricted-imports` for a file) — the ignore list is the union of both
// backlogs, and "fan-out complete" = that union is empty.
const PRISMA_DEFAULT_IMPORT_MESSAGE =
  "The `prisma` export (default OR named — prisma.ts exports both) is the UNSCOPED " +
  "client and leaks across tenants. Use getPrisma() (request context), getPlatformPrisma() " +
  "(global/registry/Impact-Lab models), or runWithTenant(tenantId, fn) (cron/workflow). " +
  "See docs/multi-tenancy-fanout-plan.md.";
const RAW_DB_TENANT_MESSAGE =
  "Raw @/lib/db SQL BYPASSES the tenant chokepoint. Query via getPrisma() (auto-scoped), " +
  "or add an explicit `AND tenantId = ?` to every statement, then drop the file from " +
  "PENDING_RAW_SQL_TENANT_AUDIT. See docs/multi-tenancy-fanout-plan.md.";
const FORBIDDEN_UNSCOPED_DB = {
  paths: [
    {
      name: "@/lib/prisma",
      importNames: ["default", "prisma"],
      message: PRISMA_DEFAULT_IMPORT_MESSAGE,
    },
    {
      name: "./prisma",
      importNames: ["default", "prisma"],
      message: PRISMA_DEFAULT_IMPORT_MESSAGE,
    },
    { name: "@/lib/db", message: RAW_DB_TENANT_MESSAGE },
  ],
};

const FORBIDDEN_INFRA_IMPORTS = {
  paths: [
    {
      name: "@/lib/prisma",
      message:
        "Route handlers and MCP tools must access the DB through src/lib/services/*. Import the matching service instead.",
    },
    {
      name: "@/lib/db",
      message:
        "Raw-SQL helpers belong inside services. Import the matching service from src/lib/services/* instead.",
    },
    {
      name: "@/lib/storage",
      message:
        "Use src/lib/services/uploads (or services/storage helpers) instead of importing storage directly.",
    },
    {
      name: "@/lib/notifications",
      message:
        "Use src/lib/services/notifications (which re-exports the dispatchers) instead of importing notifications directly.",
    },
  ],
};

// Third tenant-isolation surface: the tenantScope `$extends` hooks only intercept
// MODEL operations on the scoped client. Two escape hatches run OUTSIDE those
// hooks, so a model write issued through them skips the tenantId injection
// entirely — a silent cross-tenant leak even on a getPrisma()-scoped client:
//   1. Raw SQL — $queryRaw / $executeRaw and their *Unsafe variants.
//   2. INTERACTIVE transactions — $transaction(async tx => …): writes through the
//      `tx` client are unscoped. Batch $transaction([...]) DOES carry the
//      extension (see tenant-scope.ts) and stays allowed.
// Unlike the import bans above, these are call-site syntax (not imports), so a
// no-restricted-syntax rule is the only way to catch them. The selectors match
// the method name regardless of receiver, so they fire on the scoped client, the
// platform client, and any `tx` alias. The lone legitimate interactive tx
// (impactLab, global plane via getPlatformPrisma — no scope to bypass) is
// exempted inline at its call site, not file-wide, so the guard stays maximal.
const FORBIDDEN_CHOKEPOINT_BYPASS = [
  {
    selector:
      "MemberExpression[property.name=/^\\$(queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)$/]",
    message:
      "Raw SQL ($queryRaw/$executeRaw and *Unsafe variants) bypasses the tenantScope " +
      "chokepoint — no tenantId is injected. Use scoped getPrisma() model methods instead.",
  },
  {
    selector:
      "CallExpression[callee.property.name='$transaction'] > :matches(ArrowFunctionExpression, FunctionExpression)",
    message:
      "Interactive $transaction(async tx => …) runs OUTSIDE the tenantScope chokepoint — " +
      "writes through `tx` skip tenantId injection. Use batch $transaction([...]) (carries " +
      "the extension) or sequential scoped getPrisma() calls.",
  },
];

const eslintConfig = defineConfig([
  // Syntax-only TS parser — no `parserOptions.project`, so no type-checking
  // and no OOM. Biome owns all TS lint rules; ESLint just needs to parse.
  // The empty `@typescript-eslint` plugin registers known rule names as
  // no-ops so pre-existing inline `eslint-disable @typescript-eslint/*`
  // comments don't error after we dropped the real plugin.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": {
        rules: { "no-explicit-any": { create: () => ({}) } },
      },
      "react-hooks": {
        rules: { "exhaustive-deps": { create: () => ({}) } },
      },
    },
  },
  // Next.js-specific rules — scoped to app + components only.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  // Lockdown for routes + MCP — services are the only DB callers.
  {
    files: ["src/app/api/**/*.{ts,tsx}", "src/lib/mcp/**/*.{ts,tsx}"],
    ignores: PENDING_SERVICE_MIGRATION,
    rules: {
      "no-restricted-imports": ["error", FORBIDDEN_INFRA_IMPORTS],
    },
  },
  // Tenant-isolation ratchet — ban the unscoped default `prisma` import AND raw
  // `@/lib/db` in all non-route src files (both bypass the tenant chokepoint).
  // Disjoint from the route/MCP lockdown above (api + mcp excluded here, governed
  // there). The ignore list is the union of the two backlogs; "fan-out complete"
  // = both PENDING_TENANT_SCOPE and PENDING_RAW_SQL_TENANT_AUDIT are empty.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/app/api/**",
      "src/lib/mcp/**",
      ...PENDING_TENANT_SCOPE,
      ...PENDING_RAW_SQL_TENANT_AUDIT,
    ],
    rules: {
      "no-restricted-imports": ["error", FORBIDDEN_UNSCOPED_DB],
    },
  },
  // Tenant chokepoint bypass guard — raw SQL + interactive transactions leak
  // regardless of route vs lib, so this applies to ALL src files with no backlog.
  // Distinct rule key (no-restricted-syntax) from the import bans above, so there
  // is no flat-config last-one-wins collision with the two blocks that set
  // no-restricted-imports on overlapping file sets.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...FORBIDDEN_CHOKEPOINT_BYPASS],
    },
  },
  globalIgnores([
    ".claude/**",
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
    "scripts/**",
    "spike/**",
    "convex/**",
    "src/generated/**",
    "prisma/**",
  ]),
]);

export default eslintConfig;
