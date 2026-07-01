# Send16 transactional cutover — handoff (Dominik)

Branch: **`spruik-send16-integration`** (rebased on current `main`, post-Bun). Routes the app's
transactional + campaign email through **Send16** (Claude Community workspace, sending from
`claudecommunity.com.au`) instead of Resend. Fully reversible.

## What's in the branch
- `src/lib/send16.ts` — Send16 transport adapter → `POST $SEND16_BASE_URL/api/transactional/api/send`
  (Bearer key, `X-Send16-Source: community-app`). Shape-compatible with `resend.ts`'s `sendEmail`.
- `src/lib/resend.ts` — `sendEmail` + `sendCampaignEmails` early-return to Send16 when
  `isSend16Enabled()` (`EMAIL_PROVIDER==='send16' && SEND16_API_KEY`). Resend path untouched.
- `scripts/sync-users-to-send16.ts` — member backfill → `POST /api/contacts/upsert` (dry-run by
  default; `--commit`). Reusable as the basis for ongoing auto-sync.
- `wrangler.jsonc` — `EMAIL_PROVIDER: "send16"` added to `env.production.vars`.
- `.env.example` — `EMAIL_PROVIDER` / `SEND16_API_KEY` / `SEND16_BASE_URL`.

## Already proven (don't re-litigate)
- Send16 transactional path + **CCAU branding verified inbox delivery** to a real Gmail
  (Send16 message_ids 142898 / 142899 / 142969 — branded `getNotificationEmailHtml`, not spam).
- `claudecommunity.com.au` is **verified** in the Send16 workspace (its domain row was stuck
  `pending`; fixed — this was the one true prerequisite).

## ⚠️ STATUS: built+deployed from a non-Dominik machine TWICE → /community breaks → ROLLED BACK both times
Confirmed reproducible: **a build produced from this environment makes `/community` fail at runtime**,
while your normal build (`ae61aebf`) serves it fine.
- Attempt 1 (`cb3dce12`, base `.env`): member routes returned the app 404.
- Attempt 2 (`d77e9a62`, **all** `NEXT_PUBLIC_*` supplied, no `populateCache`): `/community` returned a
  **500 server error** ("This page couldn't load / A server error occurred").
Ruled OUT as causes: OS, the Clerk key (base `.env` pk_live = `clerk.claudecommunity.com.au` = prod),
missing public env (all have fallbacks / were supplied), and the cache pre-warm step. What's left is a
**build-toolchain runtime difference** — exactly your `docs/cloudflare-cpu-deploy-runbook.md` **Gate 2**
silent failure (`prisma` inside `unstable_cache` request-context). It does NOT reproduce on your build.
**Conclusion: the integration must be built + deployed from your environment** (correct OpenNext/wrangler
toolchain + `.env.prod`/`.env.staging`). The branch code itself is fine — it's the build that matters.
(Note: `/community` 404s on a logged-OUT `curl` on every version — only a logged-in / real browser check
catches the 500.)

## To finish it (staging → promote)
1. **Set the secret** on the env(s) you'll use — value = an `sk_live_` key from the Send16
   "Claude Community" workspace (Developers tab; default scopes cover `transactional.send` +
   `contacts.write`):
   ```
   wrangler secret put SEND16_API_KEY --env staging
   wrangler secret put SEND16_API_KEY --env production
   ```
2. **Deploy to staging:** `bun run staging:deploy`
3. **Verify on `staging.claudecommunity.com.au`:** logged-in `/community` loads (Gate 2), and a
   transactional email (trigger a notification/invite) inboxes from `noreply@claudecommunity.com.au`.
4. **Promote:** `bun run production:deploy`, then re-check logged-in `/community` + a live email.
5. **Rollback if needed:** `wrangler rollback --env production`, or just delete the secret
   (`isSend16Enabled()` → false → Resend).

## If building on Windows (e.g. Rye's box)
- `scripts/prisma-generate.mjs` calls `./node_modules/.bin/prisma` — cmd.exe can't parse the `./`
  path (`'.' is not recognized`). Use `bunx prisma generate` (works cross-platform) or build from
  WSL/mac. Worth making portable in the script.
- wrangler prompts for account selection (token has 3 accounts) and hangs non-interactively — pin
  `CLOUDFLARE_ACCOUNT_ID=<your-account-id>` (the AU value is `CF_ACCOUNT_ID_AU` in `.env.cfinfra`).

## Optional follow-on — ongoing member auto-sync
No continuous DB→Send16 sync today (the ~1,900 members were a one-time Clerk pull). Recommended: add
a step to the existing 15-min cron (`worker-scheduled.ts` → `handleScheduled`) that upserts
`User`s created/updated since the last tick to Send16 via `/api/contacts/upsert`, reusing the same
`SEND16_API_KEY`. No new infra.
