# Email Campaigns

Durable bulk email send for the admin campaign tool. Built on Cloudflare
Workflows + Resend's batch API.

## Architecture at a glance

```
POST /api/admin/email/campaigns/[id]/send          ┐
POST /api/admin/email/campaigns/[id]/resume        │  thin route — flips
                                                   │  campaign.status,
                                                   │  calls env.CAMPAIGN_SEND.create(...)
                                                   ▼
                                    CampaignSendWorkflow  (src/workflows/campaign-send.ts)
                                    │
                                    ├─ step.do "resolve-segment"
                                    │     query users by EmailCampaign.segmentQuery
                                    │     subtract anyone with an existing EmailSend row
                                    │     load suppression list
                                    │
                                    ├─ for each 100-recipient chunk:
                                    │     step.do "batch-N"             ← create EmailSend rows,
                                    │                                     personalise HTML,
                                    │                                     resend.batch.send(...)
                                    │                                     with idempotency key
                                    │                                     and permissive validation
                                    │     step.do "batch-N-counters"    ← bump EmailCampaign
                                    │                                     sentCount / failedCount
                                    │     step.sleep "batch-N-pace"     ← 600ms (tune from logs)
                                    │
                                    └─ step.do "finalize" → status = "sent"
```

The unit of tracking is the per-recipient `EmailSend` row, keyed by Resend's
returned `email_id`. The webhook at `src/app/api/webhooks/resend/route.ts`
reconciles `delivered` / `bounced` / `complained` events back onto that row.

## Why a Workflow

The previous implementation ran the batch loop inside `after()` in the route
handler. Three problems:

1. **No retry on rate limit.** A 429 from Resend marked an entire 100-recipient
   batch as `failed` and moved on. A single transient hiccup silently dropped
   100 emails.
2. **Worker time budget.** `after()` shares the request's CPU/wall-time
   budget; a large segment could exceed it half-way and leave the row stuck
   on `sending`.
3. **No durable resume.** The `/resume` route worked but required an operator
   to notice and click.

Cloudflare Workflows solves all three: each `step.do` gets its own budget,
the workflow runtime retries failed steps, and the loop survives Worker
restarts.

## Failure handling

| Failure mode | Behaviour |
|--------------|-----------|
| Resend returns 429 | Read `Retry-After` / `ratelimit-reset` from response headers; sleep that long; retry up to 3× in-loop, then the workflow-level `step.do` retries once more. |
| Resend returns 5xx | Same retry path as 429. |
| Resend returns per-message error (e.g. invalid address) | `batchValidation: "permissive"` returns `errors[]` with `{ index, message }`; only the failed positions are marked `failed`, the rest are marked `sent`. |
| Whole batch throws | Workflow-level retry runs the step again from the start; idempotency key prevents Resend double-sending. |
| Workflow dies mid-loop | Cloudflare restarts the workflow at the failed step; completed batches already have their `EmailSend.status = "sent"` rows, so the next run's `resolve-segment` skips them. |
| `RESEND_API_KEY` missing | Workflow throws on `workflow.start`; status visible in the Workflows dashboard. (Previous behaviour was to silently mark every batch `skipped`.) |

The send is **idempotent**: every batch posts with
`Idempotency-Key: campaign:{campaignId}:batch:{batchIndex}`. Resend dedups
identical requests in a 24h window, so workflow-level retries can't cause
double-sends.

## Logs

Every step emits a single line in this shape:

```
[campaign-send] {"wf":"campaign-abc123-1716000000000","campaign":"abc123","event":"batch.resend-call","batchIndex":3,"attempt":0,"elapsedMs":412,"idempotencyKey":"campaign:abc123:batch:3","rateLimit":{"ratelimit-limit":"2","ratelimit-remaining":"1","ratelimit-reset":"1"},"hasError":false}
```

Tail with:

```bash
wrangler tail --env staging --format pretty 2>&1 | grep '\[campaign-send\]'
```

Or for structured filtering:

```bash
wrangler tail --env staging --format json 2>&1 \
  | jq -r 'select(.logs[0].message[0] | test("\\[campaign-send\\]"))
           | .logs[0].message[0]
           | capture("\\[campaign-send\\] (?<j>.*)").j
           | fromjson'
```

### Event vocabulary

| `event` | Meaning |
|---------|---------|
| `workflow.start` | First line of a workflow instance. Includes `resendKeyConfigured`. |
| `workflow.no-api-key` | Fatal — `RESEND_API_KEY` missing on the Worker. |
| `workflow.batches-planned` | After segment resolution; reports `totalRecipients`, `batchCount`. |
| `workflow.nothing-to-do` | Resume case where everyone is already handled. |
| `workflow.complete` | Final aggregate counters. |
| `workflow.uncaught` | Re-thrown to terminate the instance in `errored`. |
| `segment.resolved` | Total users matching the segment, before subtracting handled. |
| `segment.filtered` | After subtracting handled + suppressed. |
| `batch.start` | Per-batch — size, suppressed count. |
| `batch.sends-created` | After creating `EmailSend` placeholder rows. |
| `batch.prepared` | After per-recipient HTML personalisation. |
| `batch.resend-call` | Each Resend API attempt. **Includes `rateLimit` headers** — this is what you grep to tune `BATCH_SLEEP`. |
| `batch.retrying` | About to sleep + retry after 429/5xx. |
| `batch.resend-error` | Out of retries OR non-retryable error. |
| `batch.reconciled` | After updating `EmailSend` rows from the response. |
| `batch.aggregate` | Running totals after each batch. |

## Tuning the pace

`BATCH_SLEEP` in `src/workflows/campaign-send.ts` is `600 milliseconds`
(~1.6 batches/sec). The starting value assumes Resend's documented default
of 2 req/s. The actual limit is account-specific.

To set it from data instead of guessing:

1. Send a campaign on staging.
2. Grep logs for `batch.resend-call` and extract the `ratelimit-limit` value.
3. Pick `BATCH_SLEEP` such that `1000 / sleep_ms < ratelimit-limit`.

If you see `batch.retrying` lines in steady state (not just occasionally),
raise `BATCH_SLEEP`. If `ratelimit-remaining` is consistently well above 0,
you can lower it.

## Resuming a stuck send

If a campaign sits on `sending` for longer than expected, hit:

```bash
curl -X POST -H "Authorization: Bearer <admin>" \
  https://claudecommunity.com.au/api/admin/email/campaigns/<id>/resume
```

This starts a *fresh* workflow instance with a new id. The workflow's
`resolve-segment` step subtracts everyone with an existing `EmailSend` row
(any status — sent, pending, or failed), so:

- Duplicates are impossible (also enforced by `@@unique([campaignId, userId])`).
- Failed recipients from a previous run are **not** retried by `/resume`.
  Surface them via the `EmailCampaign` stats UI and re-send manually if
  needed.

`/resume` is safe to call repeatedly; each call is a new workflow instance.

## Deploying

The workflow class must be exported from the deployed Worker script so
Cloudflare can find it. OpenNext owns `.open-next/worker.js` and rewrites it
every build, so we patch it with `scripts/inject-workflow-exports.mjs` after
each `opennextjs-cloudflare build`. The script is already wired into
`bun run build:cf`.

**To register a new workflow alongside `CampaignSendWorkflow`:**

1. Add a `[[workflows]]` entry to all three places in `wrangler.jsonc`
   (top-level, `env.production`, `env.staging`).
2. Add an entry to the `WORKFLOWS` array in
   `scripts/inject-workflow-exports.mjs`.

### Required secrets

| Secret | Used by |
|--------|---------|
| `RESEND_API_KEY` | The workflow reads it from `this.env`. Set via `wrangler secret put RESEND_API_KEY --env <staging\|production>`. |
| `RESEND_WEBHOOK_SECRET` | For the webhook reconciliation route, not the workflow. |

`process.env.RESEND_API_KEY` does **not** work inside workflows on this
project — `nodejs_compat_populate_process_env` is not enabled. Always use
`this.env` from `WorkflowEntrypoint`, or `getEnv()` from `src/lib/cf-env.ts`
when called transitively from a workflow.

## End-to-end staging test

Use `scripts/e2e-campaign-staging.sh` to seed simulator-only recipients,
fire the workflow, and tear everything down. Each run gets a timestamped
runId so they don't collide; `cleanup` wipes by the shared `e2e-campaign-`
prefix.

```bash
# 1. Seed 250 users (80% delivered, 10% bounced, 10% complained simulator
#    addresses) + tag + draft EmailCampaign. Prints the campaign ID.
./scripts/e2e-campaign-staging.sh seed 250

# 2. Tail logs (separate terminal).
./scripts/e2e-campaign-staging.sh tail

# 3. Trigger the send. Either click Send in /admin/email signed in as
#    admin, OR paste the DevTools snippet printed by:
./scripts/e2e-campaign-staging.sh send <campaignId>

# 4. Watch counters tick (separate terminal). Exits when status reaches
#    `sent` or `errored`.
./scripts/e2e-campaign-staging.sh monitor <campaignId>

# 5. Nuke all e2e-campaign-* rows from D1 (Users, UserTag,
#    UserTagAssignment, EmailCampaign, EmailSend, and matching suppression
#    entries).
./scripts/e2e-campaign-staging.sh cleanup
```

The send path goes through the real workflow on staging, so this exercises:

- segment resolution (via `UserTagAssignment`),
- batching at 100/req with the configured `BATCH_SLEEP`,
- idempotency keys,
- `batchValidation: "permissive"` (bounced/complained recipients accept the
  message; the failure is async via webhook),
- `EmailSend.status` transitions sent → delivered/bounced/complained,
- webhook handler adding hard-bounces + complaints to
  `EmailSuppressionList`.

All test traffic uses `*+e2e<runId>-NNNN@resend.dev` so it does not hit
any real inbox. Quota note: Resend's docs don't confirm whether simulator
addresses count against the daily quota — assume they do, and keep
load-test runs ≤ 250.

## Where to look

| File | Purpose |
|------|---------|
| `src/workflows/campaign-send.ts` | The workflow itself. |
| `src/app/api/admin/email/campaigns/[id]/send/route.ts` | Kickoff route. |
| `src/app/api/admin/email/campaigns/[id]/resume/route.ts` | Resume route. |
| `src/app/api/webhooks/resend/route.ts` | Reconciles delivery/bounce/complaint events back onto `EmailSend`. |
| `src/lib/email/{blocks,tracking,unsubscribe,wrap}.ts` | HTML rendering + per-recipient tracking pixel/link rewrite. |
| `scripts/inject-workflow-exports.mjs` | Post-build patch that exports workflow classes from the Worker. |
| `wrangler.jsonc` | `[[workflows]]` bindings. |
