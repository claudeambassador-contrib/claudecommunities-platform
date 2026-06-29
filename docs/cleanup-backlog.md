# Cleanup backlog

Larger structural cleanups identified during the June 2026 comb-over
(branch `cleanup-fable`), ordered by payoff. The quick wins from that pass
(dead files, unused deps, duplicated helpers, `alert()` → toast) are already
done; what's left here is multi-PR work.

## 1. Email admin routes → service layer (highest payoff)

All 19 routes under `src/app/api/admin/email/**` (plus `api/cron/*`,
`api/email/track/*`, `api/webhooks/resend`) talk to Prisma directly and use
ad-hoc `try/catch` + `requirePermissionResponse` instead of
`withService()` + `ServiceError`. They are the bulk of
`PENDING_SERVICE_MIGRATION` in `eslint.config.mjs`.

Suggested slicing, one PR each, removing the migrated paths from
`PENDING_SERVICE_MIGRATION` as you go:

1. `src/lib/services/emailContacts.ts` — contact lists + contacts + segments
2. `src/lib/services/emailCampaigns.ts` — campaign CRUD + send/resume/test
   (workflow kickoff stays in the service, mirroring `socialPosts.ts`)
3. `src/lib/services/emailTemplates.ts` — templates + saved blocks
4. Tracking/webhook/cron routes last (they're small but touch `emailSend`)

Pattern to copy: `src/lib/services/badges.ts` or `courses.ts` for the
service, `src/app/api/bookmarks/route.ts` for the thin route adapter.

## 2. Remaining service-layer bypasses

Non-email entries still in `PENDING_SERVICE_MIGRATION`: admin event
resources/rsvps, luma-sync, import, invite, sync-users, course progress,
impact-lab interest/sponsor. Same recipe as above; `admin/invite` is the
worst single file (~140 lines of inline permission checks + Prisma).

## 3. Route auth pattern consolidation

Two competing idioms: legacy `requirePermissionResponse` (`@/lib/route-auth`)
vs `withService()` + `requireSessionUser`/`ensurePermission` in services.
Falls out of #1/#2 naturally — once the last `route-auth.ts` caller is
migrated, delete the module.

## 4. Post composer/editor duplication

`src/components/PostComposer.tsx` (~700 lines) and
`src/components/PostEditModal.tsx` (~430 lines) duplicate media upload,
preview, and submission state (`PostComposer` in `admin/social/` is a
different domain — leave it). Extract a shared `usePostForm()` hook for
upload + media + submit state rather than merging the components.

## 5. Smaller items

- `src/components/LessonContent.tsx`: 8+ repeated
  `dynamic(() => import(...), { ssr: false })` blocks could collapse into a
  loader map.
- CORS headers are defined inline in `api/upload/mcp` and `api/files/[...key]`;
  they differ (methods, streaming GET) so a shared helper is optional — only
  extract if a third CORS route appears.
- `docs/biome-strict-backlog.md` still lists Biome rules parked at `warn`
  (the 93 lint warnings) — ratchet per that doc.
