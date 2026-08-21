# Email Campaigns

Durable campaign send for city admin. Resend + `CAMPAIGN_SEND` workflow.
The Next `EmailBuilder` block designer is **not** on Start — list, HTML
body, schedule, and send only. See
[`start-conversion-status.md`](./start-conversion-status.md) phase 5.

## Architecture

```
City admin Send / cron drain of due scheduled campaigns
  → startCampaignSend (status → sending)
  → env.CAMPAIGN_SEND.create({ campaignId, d1Binding, orgId })
       CampaignSendWorkflow  (apps/web/src/workflows/campaign-send.ts)
         step "claim"
         step "send-batch"  → sendCampaign + Resend batch
         step "finalize"
```

`sendCampaign` (`apps/web/src/modules/email/services/emailSendService.ts`)
loads the city campaign, lists recipients from REGISTRY, skips addresses
already in `email_sends`, posts one Resend batch, and writes send rows.

Cron (`apps/web/src/worker-scheduled.ts`, every 15 minutes) walks active
cities and starts the same workflow for `status="scheduled"` rows whose
`scheduledAt` is due.

The webhook at `/api/webhooks/resend` verifies Svix headers with
`RESEND_WEBHOOK_SECRET` and reconciles delivery / bounce / complaint onto
`email_sends`.

## Why a Workflow

The send must survive Worker death mid-call. Each `step.do` is
checkpointed; a retry re-opens the city D1 and skips addresses that
already have an `email_sends` row.

Local `wrangler dev` does not run Workflows. Send actions fail with a
clear message if `CAMPAIGN_SEND` is missing.

## Secrets

| Secret                  | Used by                                      |
| ----------------------- | -------------------------------------------- |
| `RESEND_API_KEY`        | Workflow + transport (`this.env`)            |
| `RESEND_WEBHOOK_SECRET` | `/api/webhooks/resend` Svix verification     |

Set on the Start Worker: `wrangler secret put <NAME> --env staging`.
`process.env.RESEND_API_KEY` is not populated in workflows — read
`this.env`.

## Where to look

| File | Purpose |
| ---- | ------- |
| `apps/web/src/workflows/campaign-send.ts` | Workflow |
| `apps/web/src/modules/email/services/emailSendService.ts` | Recipients + Resend batch + `email_sends` |
| `apps/web/src/modules/email/services/emailCampaignsService.ts` | CRUD, schedule, kickoff |
| `apps/web/src/modules/email/services/emailWebhookService.ts` | Delivery events |
| `apps/web/src/routes/api/webhooks/resend.ts` | Svix webhook |
| `apps/web/src/worker-scheduled.ts` | Due-campaign drain |
| `apps/web/src/server.ts` | Exports `CampaignSendWorkflow` |

Staging smoke: [`start-cutover.md`](./start-cutover.md).
