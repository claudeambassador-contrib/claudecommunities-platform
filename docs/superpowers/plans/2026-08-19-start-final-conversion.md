# Start Final Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the last Start gaps (real email send, MCP usable from the CLI, staging Worker) so Next/Prisma/OpenNext can be deleted. There is no production traffic — staging is the only Cloudflare target.

**Architecture:** Keep send/publish logic in testable module services. Workflows and cron only open D1 stores and call those services. Recipients come from REGISTRY memberships; campaign rows and `email_sends` live on the city D1.

**Tech Stack:** TanStack Start, Drizzle/D1, Clerk, Resend HTTP API, Cloudflare Workflows + cron, existing MCP catalog at `/api/mcp`.

**Spec:** This plan. Supporting docs: `docs/email-campaigns.md`, `docs/start-cutover.md`, `docs/start-conversion-status.md`.

## Global Constraints

- Package manager is Bun (`apps/web`).
- SQL is SQLite/D1 (`?` placeholders only).
- No Next, Prisma, or OpenNext imports in `apps/web`.
- Clean-slate Start D1s — no ETL from the Next shared D1.
- Do not commit `.env*`, `.superpowers/`, or `e2e/**/artifacts/`.
- HTML campaign body is accepted as-is (no EmailBuilder port in this plan).
- Zernio is the social connector; native LinkedIn OAuth is out of scope.
- Slide PNG export stays deferred unless Browser Rendering is already wired.

## File map

| File                                                           | Responsibility                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web/src/modules/email/transport.ts`                      | Resend batch adapter + `EmailTransport` port                            |
| `apps/web/src/modules/email/services/emailSendService.ts`      | Resolve members, write `email_sends`, call transport, finalize campaign |
| `apps/web/src/workflows/campaign-send.ts`                      | Durable steps around `sendCampaign`                                     |
| `apps/web/src/modules/email/services/emailCampaignsService.ts` | Pass `orgId` + `d1Binding` into the workflow                            |
| `apps/web/src/routes/$citySlug/admin/email/$id.tsx`            | Send button (`email.send`)                                              |
| `apps/web/src/worker-scheduled.ts`                             | Drain due `scheduled` campaigns                                         |
| `apps/web/src/routes/api/webhooks/resend.ts`                   | Mark `email_sends` delivered/bounced                                    |
| `apps/web/src/routes/api/email/unsubscribe.$token.ts`          | One-click unsubscribe (registry prefs)                                  |
| `apps/web/README.md` + `docs/start-conversion-status.md`       | Staging deploy + MCP CLI target                                         |
| Root Next tree                                                 | Delete only after staging smoke on Start                                |

---

### Task 1: Real campaign send (service + workflow + Send button)

**Files:**

- Create: `apps/web/src/modules/email/transport.ts`
- Create: `apps/web/src/modules/email/services/emailSendService.ts`
- Create: `apps/web/test/email/emailSendService.test.ts`
- Modify: `apps/web/src/workflows/campaign-send.ts`
- Modify: `apps/web/src/modules/email/types.ts` (`CampaignWorkflow` payload)
- Modify: `apps/web/src/modules/email/services/emailCampaignsService.ts`
- Modify: `apps/web/src/modules/identity/repositories/directoryRepository.ts` (recipient list)
- Modify: `apps/web/src/routes/$citySlug/admin/email/$id.tsx`
- Modify: `apps/web/src/worker-scheduled.ts`
- Modify: `apps/web/worker-configuration.d.ts` (`RESEND_API_KEY`)
- Test: `apps/web/test/email/emailCampaignsService.test.ts`

**Interfaces:**

- Consumes: `listOrgMembers` / new `listOrgRecipients`, `emailCampaigns`, `emailSends`, `getEmailSettings`
- Produces: `sendCampaign(store, registry, campaignId, transport)` → `{ sent, failed, skipped }`

- [x] **Step 1:** Write `emailSendService` tests: fake transport, two members, skip banned, skip already-sent, mark campaign `sent`.
- [x] **Step 2:** Run `cd apps/web && bun run test test/email/emailSendService.test.ts` — expect FAIL (module missing).
- [x] **Step 3:** Implement transport port + `sendCampaign` + workflow that opens tenant + registry like `publish-post.ts`.
- [x] **Step 4:** Re-run tests — expect PASS.
- [x] **Step 5:** Add Send button and cron drain for due campaigns. Update enqueue payload to `{ campaignId, orgId, d1Binding }`.
- [x] **Step 6:** `cd apps/web && bun run test test/email`

---

### Task 2: Unsubscribe + Resend webhook

**Files:**

- Create: `apps/web/src/modules/email/services/emailWebhookService.ts`
- Create: `apps/web/src/routes/api/webhooks/resend.ts`
- Create: `apps/web/src/routes/api/email/unsubscribe.$token.ts`
- Create: `apps/web/test/email/emailWebhookService.test.ts`
- Modify: `apps/web/src/modules/identity/schema.registry.ts` if a `campaigns` / `unsubscribed` pref is missing — otherwise reuse `weeklyDigest: false` as the suppression flag for campaign mail.

**Interfaces:**

- Produces: `applyResendEvent({ resendId, type })`, `unsubscribeEmail(email)`
- Campaign HTML can append `List-Unsubscribe` later; first cut is a `/api/email/unsubscribe/$token` HMAC using `RESEND_API_KEY` or `RENDER_SIGNING_SECRET`.

- [x] **Step 1:** Tests for bounce → `email_sends.status = bounced`, unsubscribe → no longer in recipient list.
- [x] **Step 2:** Implement webhook + unsubscribe routes.
- [x] **Step 3:** `bun run test test/email`

---

### Task 3: MCP CLI against Start

**Files:**

- Modify: `apps/web/README.md` (CLI `MCP_URL=http://localhost:3001/api/mcp`)
- Modify: `cli/` only if it hardcodes a Next origin
- Test: `apps/web/test/mcp/mcpService.test.ts` — add `health` + `getFeed` dispatch smoke if missing
- Check: `apps/web/src/routes/api/upload.ts` vs `requestImageUploadUrl`

- [x] **Step 1:** Confirm `MCP_CATALOG` names match `mcpService` dispatch (no missing cases).
- [x] **Step 2:** Document Clerk JWT + Start URL for the existing CLI.
- [x] **Step 3:** Fix any upload/MCP 404 (`/api/upload/mcp` if the helper still points there).

---

### Task 4: Staging Worker is Start

**Files:**

- Modify: `apps/web/README.md`, `docs/start-cutover.md`, `docs/start-conversion-status.md`
- Modify: `apps/web/.env.example` (`RESEND_API_KEY`, `ZERNIO_API_KEY`)

- [x] **Step 1:** Checklist: `gen:wrangler`, remote D1 migrate REGISTRY + city bindings, secrets, `deploy:staging`.
- [ ] **Step 2:** Smoke: login, send one campaign, MCP `health`, upload, social schedule.
- [x] **Step 3:** Mark cutover preconditions done in `docs/start-cutover.md`.

---

### Task 5: Delete Next / Prisma / OpenNext

**Only after Task 4 smoke.** Destructive.

Remove: `src/app`, `src/middleware.ts`, `prisma/`, `migrations/`, `next.config.ts`, `open-next.config.ts`, `@opennextjs/*`, `@clerk/nextjs`, `next`, `patches/@opennextjs*`, `scripts/inject-workflow-exports.mjs`, Next-only root `package.json` scripts (`dev`/`build`/`start` that call `next`).

Point root `dev`/`test`/`check` at `apps/web`. Keep `cli/` and `mcp-ui/` if they only need a URL change.

---

## Out of scope

- Next EmailBuilder block designer
- Full slide-generator visual editor + Browser Rendering export
- Native LinkedIn OAuth (Zernio only)
- AU/NZ second Cloudflare account
- Migrating Next staging D1 rows
