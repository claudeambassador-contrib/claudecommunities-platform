/**
 * Durable email-campaign send.
 *
 * Replaces the in-request `after()` loop that previously lived in
 * `src/lib/email/campaign-send.ts`. Reasons for moving to a Cloudflare
 * Workflow:
 *
 *  - **Worker time budget**: an `after()` callback shares the parent
 *    request's CPU/wall-time budget. A large segment (thousands of
 *    recipients) could exceed it silently, leaving the campaign half-sent
 *    with the row still `sending`. Each workflow `step.do` gets its own
 *    budget and the workflow itself is durable across Worker restarts.
 *  - **Rate-limit safety**: the previous loop marked an entire 100-recipient
 *    batch as `failed` on any error — including a single 429. This workflow
 *    uses Resend's `batchValidation: 'permissive'` so individual failures
 *    don't poison the rest, and on 429 it sleeps for the Resend-suggested
 *    backoff before retrying. Idempotency keys make those retries safe.
 *  - **Resume**: a workflow that crashes mid-loop can be restarted by
 *    creating a new workflow with the same `campaignId`; the recipient
 *    resolution skips anyone with an existing `EmailSend` row, mirroring
 *    the old `/resume` route.
 *
 * The unit of tracking remains the per-recipient `EmailSend` row keyed by
 * Resend's `email_id` — the webhook handler at
 * `src/app/api/webhooks/resend/route.ts` continues to work unchanged.
 */

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { type CreateBatchSuccessResponse, type ErrorResponse, Resend } from "resend";
import { runWithEnv } from "@/lib/cf-env";
// Aliased to avoid shadowing by the local `chunk` recipient-slice variable below.
import { chunk as inChunks } from "@/lib/chunk";
import { renderCampaignHtml } from "@/lib/email/blocks";
import { prepareEmailForSending } from "@/lib/email/tracking";
import { generateUnsubscribeToken } from "@/lib/email/unsubscribe";
import { wrapEmailContent } from "@/lib/email/wrap";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/tenant-config";
import { runWithTenant } from "@/lib/tenant-context";

/** Resend's batch endpoint hard-caps at 100 emails per request. */
const BATCH_SIZE = 100;

/** Sleep between batches. Resend's default rate limit is 2 req/s on most
 *  accounts (some teams have 5 req/s); 600ms is a safe floor either way and
 *  the workflow honours `ratelimit-reset` / `retry-after` on 429 so this is
 *  the steady-state pacing, not the worst-case. */
const BATCH_SLEEP = "600 milliseconds";

/** How many times to retry a single batch on transient (5xx / 429) failure
 *  before giving up and marking the batch's recipients as `failed`. The
 *  workflow runtime also retries the whole `step.do` once, so total
 *  attempts can reach 2 * (1 + inner) — generous on purpose for sends. */
const INNER_BATCH_RETRIES = 3;

export interface CampaignSendParams {
  campaignId: string;
  /** Tenant that owns the campaign. The dispatch route stamps it (request
   *  header); run() re-enters runWithTenant(tenantId) inside every step.
   *  resolveSegment scopes the campaign lookup to it (fail-closed if the
   *  campaign isn't in this tenant) and queryRecipients restricts recipients
   *  to this tenant's members. */
  tenantId: string;
  /** Workflow instance id; equals `crypto.randomUUID()` chosen by the
   *  caller so it can be persisted (e.g. as `EmailCampaign.workflowId`)
   *  before kickoff. Logged on every line for correlation. */
  workflowId: string;
  baseUrl: string;
  /** Snapshot of the campaign's HTML/blocks/subject at send time. We pass
   *  it in rather than re-reading from the DB so a mid-send edit to the
   *  campaign row doesn't change what's already going out. */
  campaignSubject: string;
  campaignHtml: string;
  campaignBlocks: string | null;
  /** When true, sentCount/failedCount on `EmailCampaign` accumulate on top
   *  of existing values (resume path). Defaults to false (fresh send). */
  accumulateCounters?: boolean;
}

interface CampaignRecipient {
  id: string;
  email: string;
  name: string | null;
}

interface BatchOutcome {
  /** Equals `live.length` of the batch (sent or failed). */
  attempted: number;
  /** Subset of `attempted` that Resend accepted. */
  sent: number;
  /** Subset of `attempted` that Resend rejected (4xx other than 429, or
   *  permissive-mode per-message errors). */
  failed: number;
  /** Recipients skipped because they're in the suppression list. */
  skipped: number;
}

interface ResolvedSegment {
  totalSegmentSize: number;
  alreadyHandled: number;
  /** Recipients still needing a send. Empty when nothing to do. */
  recipients: CampaignRecipient[];
  /** Suppression-list emails (lowercased). Filtered out inside each batch
   *  step so the resume path also honours suppressions added after the
   *  initial send. */
  suppressedEmails: string[];
  baselineSent: number;
  baselineFailed: number;
}

interface PreparedEmail {
  sendId: string;
  userId: string;
  email: string;
  html: string;
  headers: Record<string, string>;
}

/** Structured logger passed down into batch helpers. */
type BatchLog = (
  level: "log" | "warn" | "error",
  event: string,
  details?: Record<string, unknown>,
) => void;

/** Outcome of one batch send (with retries). The provider-id array is index-
 *  aligned with the input `prepared[]`; entries are null at positions that
 *  failed (Resend permissive mode + the Send16 path both report it this way),
 *  and the caller reconciles failures via `permissiveErrors[].index`. */
interface BatchSendResult {
  succeeded: boolean;
  sendIdsFromResend: Array<{ id: string } | null>;
  permissiveErrors: Array<{ index: number; message: string }>;
  lastErrorMessage: string | null;
}

/** Helper: structured log line. Keeps every line greppable by workflow id +
 *  campaign id, and avoids accidental PII leakage by never dumping the
 *  recipient list. */
function logLine(
  level: "log" | "warn" | "error",
  workflowId: string,
  campaignId: string,
  event: string,
  details?: Record<string, unknown>,
): void {
  const payload = { wf: workflowId, campaign: campaignId, event, ...details };
  // biome-ignore lint/suspicious/noConsole: workflow telemetry
  console[level](`[campaign-send] ${JSON.stringify(payload)}`);
}

export class CampaignSendWorkflow extends WorkflowEntrypoint<CloudflareEnv, CampaignSendParams> {
  async run(event: WorkflowEvent<CampaignSendParams>, step: WorkflowStep): Promise<BatchOutcome> {
    const params = event.payload;
    const env = this.env;
    // step.do callbacks run in a fresh async context inheriting neither the
    // CloudflareEnv ALS nor the tenant ALS from run(). Re-enter both inside
    // every step so getPrisma() resolves the DB binding AND the payload tenant
    // (workflows have no request header). Applied uniformly — harmless on the
    // platform-only steps, and uniform = no step silently left unscoped.
    const inScope = <T>(fn: () => Promise<T>): Promise<T> =>
      runWithEnv(env, () => runWithTenant(params.tenantId, fn));
    const log = (
      level: "log" | "warn" | "error",
      e: string,
      details?: Record<string, unknown>,
    ): void => logLine(level, params.workflowId, params.campaignId, e, details);

    // Read the Resend API key from `this.env`, not `process.env`. Workflows
    // don't go through the OpenNext fetch wrapper that synthesises
    // `process.env`, and `nodejs_compat_populate_process_env` is not enabled
    // on this worker — so `process.env.RESEND_API_KEY` is undefined at
    // workflow-runtime. Fail loud on a missing key rather than silently
    // marking every batch skipped (the previous behaviour).
    const resendApiKey = (env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
    // Per-tenant branding. Resolved inside `inScope` because getTenantConfig()
    // reads the tenant config and throws fail-closed outside a tenant scope —
    // and run()'s top level is NOT yet scoped (each step re-enters inScope).
    // `fromEmail` override comes from the Worker env (not process.env, which
    // workflows don't populate); else the tenant's configured sender.
    const { fromEmail, siteUrl, appUrl } = await inScope(async () => {
      const config = await getTenantConfig();
      const override = (env as { RESEND_FROM_EMAIL?: string } | undefined)?.RESEND_FROM_EMAIL;
      return {
        fromEmail: override ?? config.fromEmail,
        siteUrl: config.siteUrl,
        appUrl: config.appUrl,
      };
    });

    // Send16 transport (reversible cutover). When EMAIL_PROVIDER=send16 and a
    // key is on the Worker env, each recipient is sent via Send16's
    // transactional API instead of Resend's batch API. Engagement events
    // (delivered/bounce/open/click) flow back through Send16's outbound webhook
    // → /api/webhooks/send16, which updates the same EmailSend rows. Read from
    // `env` (not process.env) for the same reason as RESEND_API_KEY above.
    const send16ApiKey = (env as unknown as { SEND16_API_KEY?: string }).SEND16_API_KEY;
    const emailProvider = (env as unknown as { EMAIL_PROVIDER?: string }).EMAIL_PROVIDER;
    const send16BaseUrl =
      (env as unknown as { SEND16_BASE_URL?: string }).SEND16_BASE_URL ?? "https://api.send16.com";
    const useSend16 =
      emailProvider === "send16" && typeof send16ApiKey === "string" && send16ApiKey.length > 0;

    log("log", "workflow.start", {
      baseUrl: params.baseUrl,
      accumulateCounters: params.accumulateCounters === true,
      subjectLen: params.campaignSubject.length,
      provider: useSend16 ? "send16" : "resend",
      resendKeyConfigured: typeof resendApiKey === "string" && resendApiKey.length > 0,
    });

    // Only the ACTIVE transport's key is required. On Send16 we don't need a
    // Resend key (and vice-versa). useSend16 already proves SEND16_API_KEY is set.
    if (!useSend16 && !resendApiKey) {
      log("error", "workflow.no-api-key", {
        hint:
          "RESEND_API_KEY is not on the worker's CloudflareEnv. " +
          "Set it via `wrangler secret put RESEND_API_KEY --env <staging|production>`.",
      });
      throw new Error("RESEND_API_KEY is not configured on the Worker");
    }

    try {
      // ─── 1. Resolve segment + suppression list ─────────────────────────
      const resolved = await step.do("resolve-segment", () =>
        inScope(() => this.resolveSegment(params, log)),
      );

      if (resolved.recipients.length === 0) {
        log("log", "workflow.nothing-to-do", {
          totalSegmentSize: resolved.totalSegmentSize,
          alreadyHandled: resolved.alreadyHandled,
        });
        await step.do("mark-sent-empty", () =>
          inScope(async () => {
            const db = await getPrisma();
            // Don't overwrite an existing `sentAt` (this is the resume path
            // where every recipient is already handled — `sentAt` belongs to
            // the original send).
            const existing = await db.emailCampaign.findUnique({
              where: { id: params.campaignId },
              select: { sentAt: true },
            });
            await db.emailCampaign.update({
              where: { id: params.campaignId },
              data: {
                status: "sent",
                ...(existing?.sentAt ? {} : { sentAt: new Date() }),
              },
            });
          }),
        );
        return { attempted: 0, sent: 0, failed: 0, skipped: 0 };
      }

      // ─── 2. Iterate batches ────────────────────────────────────────────
      const total = resolved.recipients.length;
      const batchCount = Math.ceil(total / BATCH_SIZE);
      log("log", "workflow.batches-planned", {
        totalRecipients: total,
        batchCount,
        batchSize: BATCH_SIZE,
        batchSleep: BATCH_SLEEP,
      });

      const aggregate: BatchOutcome = { attempted: 0, sent: 0, failed: 0, skipped: 0 };

      for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const chunk = resolved.recipients.slice(start, start + BATCH_SIZE);
        const stepName = `batch-${batchIndex}`;

        const outcome: BatchOutcome = await step.do(
          stepName,
          // Workflow-level retry as a safety net — `processBatch` already
          // handles 429 internally, but isolate evictions / transient
          // throws still benefit from one outer retry with backoff.
          { retries: { limit: 1, delay: "5 seconds", backoff: "exponential" } },
          () =>
            inScope(() =>
              this.processBatch({
                params,
                batchIndex,
                chunk,
                suppressed: new Set(resolved.suppressedEmails),
                resolvedHtml: renderCampaignHtml(params.campaignHtml, params.campaignBlocks, {
                  siteUrl,
                }),
                resendApiKey: resendApiKey ?? "",
                fromEmail,
                appUrl,
                useSend16,
                send16ApiKey: send16ApiKey ?? "",
                send16BaseUrl,
                log,
              }),
            ),
        );

        aggregate.attempted += outcome.attempted;
        aggregate.sent += outcome.sent;
        aggregate.failed += outcome.failed;
        aggregate.skipped += outcome.skipped;

        // Persist incremental progress so the UI shows movement even if the
        // workflow dies mid-loop.
        await step.do(`${stepName}-counters`, () =>
          inScope(async () => {
            await (await getPrisma()).emailCampaign.update({
              where: { id: params.campaignId },
              data: {
                sentCount: resolved.baselineSent + aggregate.sent,
                failedCount: resolved.baselineFailed + aggregate.failed,
              },
            });
          }),
        );

        log("log", "batch.aggregate", {
          batchIndex,
          batchesDone: batchIndex + 1,
          batchesTotal: batchCount,
          aggregate,
        });

        // Sleep between batches. Skip the final sleep — pointless.
        if (batchIndex + 1 < batchCount) {
          await step.sleep(`${stepName}-pace`, BATCH_SLEEP);
        }
      }

      // ─── 3. Finalise ───────────────────────────────────────────────────
      await step.do("finalize", () =>
        inScope(async () => {
          await (await getPrisma()).emailCampaign.update({
            where: { id: params.campaignId },
            data: { status: "sent", sentAt: new Date() },
          });
        }),
      );

      log("log", "workflow.complete", { aggregate });
      return aggregate;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("error", "workflow.uncaught", { message });
      // Best-effort flip to "errored" so the UI doesn't sit on "sending"
      // forever. The campaign row schema currently has only the three
      // statuses {draft, scheduled, sending, sent}; we'd prefer a real
      // `errored` state but lacking that, leave it on `sending` and surface
      // via logs / counters. Re-throw so the workflow instance terminates
      // in `errored` state for dashboard visibility.
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Segment resolution
  // ─────────────────────────────────────────────────────────────────────

  private async resolveSegment(
    params: CampaignSendParams,
    log: (
      level: "log" | "warn" | "error",
      event: string,
      details?: Record<string, unknown>,
    ) => void,
  ): Promise<ResolvedSegment> {
    const db = await getPrisma();
    // Scoped lookup: if the campaign isn't in params.tenantId this returns null
    // and we throw before any send — the workflow's fail-closed guard against a
    // cross-tenant campaignId (the dispatch route's snapshot read is unscoped).
    const campaign = await db.emailCampaign.findUnique({
      where: { id: params.campaignId },
      select: { segmentQuery: true, sentCount: true, failedCount: true },
    });
    if (!campaign) {
      throw new Error(`Campaign not found: ${params.campaignId}`);
    }

    const everyone = await queryRecipients(campaign.segmentQuery, params.tenantId);
    log("log", "segment.resolved", {
      totalSegmentSize: everyone.length,
      segmented: campaign.segmentQuery !== null,
    });

    // Skip anyone with an existing EmailSend row (sent, pending, or failed).
    // Same logic as the old `/resume` route — applied universally so the
    // workflow is idempotent on retry.
    const existing = await db.emailSend.findMany({
      where: { campaignId: params.campaignId },
      select: { userId: true },
    });
    const handled = new Set(existing.map((s) => s.userId));
    const recipients = everyone.filter((r) => !handled.has(r.id));

    // Update the campaign's recipient count to reflect what we'll attempt
    // this run, but only if it's the first run (no accumulation) so we
    // don't overwrite the original segment size on resume.
    if (!params.accumulateCounters) {
      await db.emailCampaign.update({
        where: { id: params.campaignId },
        data: {
          recipientCount: everyone.length,
          sentCount: 0,
          failedCount: 0,
        },
      });
    }

    // EmailSuppressionList is GLOBAL (an unsubscribe is platform-wide), so the
    // unscoped platform client is correct here.
    const suppRows = await (await getPlatformPrisma()).emailSuppressionList.findMany({
      select: { email: true },
    });
    const suppressedEmails = suppRows.map((r) => r.email.toLowerCase());

    log("log", "segment.filtered", {
      totalSegmentSize: everyone.length,
      alreadyHandled: handled.size,
      remaining: recipients.length,
      suppressionListSize: suppressedEmails.length,
      baselineSent: params.accumulateCounters ? (campaign.sentCount ?? 0) : 0,
      baselineFailed: params.accumulateCounters ? (campaign.failedCount ?? 0) : 0,
    });

    return {
      totalSegmentSize: everyone.length,
      alreadyHandled: handled.size,
      recipients,
      suppressedEmails,
      baselineSent: params.accumulateCounters ? (campaign.sentCount ?? 0) : 0,
      baselineFailed: params.accumulateCounters ? (campaign.failedCount ?? 0) : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Per-batch send
  // ─────────────────────────────────────────────────────────────────────

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; decomposing this batch-send routine into helpers requires threading shared state, out of scope for a lint pass
  private async processBatch(args: {
    params: CampaignSendParams;
    batchIndex: number;
    chunk: CampaignRecipient[];
    suppressed: Set<string>;
    resolvedHtml: string;
    resendApiKey: string;
    fromEmail: string;
    appUrl: string;
    useSend16: boolean;
    send16ApiKey: string;
    send16BaseUrl: string;
    log: BatchLog;
  }): Promise<BatchOutcome> {
    const {
      params,
      batchIndex,
      chunk,
      suppressed,
      resolvedHtml,
      resendApiKey,
      fromEmail,
      appUrl,
      useSend16,
      send16ApiKey,
      send16BaseUrl,
      log,
    } = args;
    const result: BatchOutcome = { attempted: 0, sent: 0, failed: 0, skipped: 0 };

    // 1. Filter out suppressions.
    const live = chunk.filter((r) => {
      if (suppressed.has(r.email.toLowerCase())) {
        result.skipped += 1;
        return false;
      }
      return true;
    });
    log("log", "batch.start", {
      batchIndex,
      received: chunk.length,
      live: live.length,
      skipped: result.skipped,
    });
    if (live.length === 0) return result;

    // 2. Create EmailSend rows so we have stable IDs for tracking pixels.
    let created: Array<{ id: string; userId: string }>;
    try {
      // createManyAndReturn binds several params per row (the explicit fields
      // plus Prisma's client-generated id/createdAt), so a full BATCH_SIZE
      // insert would exceed D1's 100-param cap. Chunk the DB write small; the
      // Resend batch below still goes out as one BATCH_SIZE request.
      created = [];
      // Platform client + EXPLICIT tenantId on every row. EmailSend.campaignId
      // is a tenant-scoped scalar FK, which the scoped createMany rejects
      // fail-closed (B2.1 — it can't connect-validate per row). The audited
      // escape applies here because campaignId is constant AND already proven
      // in-tenant by resolveSegment's scoped findUnique under params.tenantId,
      // and recipients are restricted to this tenant's members. tenantId MUST
      // be set — it's @default("") so omitting it silently writes "" (worse
      // than the leak we're closing). Do NOT generalise this off-chokepoint
      // write; keep it local to this one pre-validated site.
      const platform = await getPlatformPrisma();
      for (const part of inChunks(live, 10)) {
        const rows = await platform.emailSend.createManyAndReturn({
          data: part.map((r) => ({
            tenantId: params.tenantId,
            campaignId: params.campaignId,
            userId: r.id,
            status: "pending",
            unsubscribeToken: generateUnsubscribeToken(r.id, `tmp-${crypto.randomUUID()}`),
          })),
          select: { id: true, userId: true },
        });
        created.push(...rows);
      }
    } catch (err) {
      // Most likely cause: @@unique([campaignId, userId]) — e.g. workflow
      // restarted mid-batch and is replaying. Surface and bail; the
      // counters route won't bump for this batch so progress remains
      // accurate.
      log("error", "batch.create-sends-failed", {
        batchIndex,
        liveCount: live.length,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ...result, attempted: live.length, failed: live.length };
    }
    log("log", "batch.sends-created", { batchIndex, sendsCreated: created.length });

    const sendIdByUserId = new Map(created.map((c) => [c.userId, c.id]));

    // 3. Personalise per-recipient HTML + per-recipient tracking pixel.
    const prepared: PreparedEmail[] = [];
    for (const r of live) {
      const sendId = sendIdByUserId.get(r.id);
      if (!sendId) continue;
      const finalToken = generateUnsubscribeToken(r.id, sendId);
      const personalisedHtml = resolvedHtml
        .replace(/\{\{name\}\}/g, r.name || "there")
        .replace(/\{\{email\}\}/g, r.email);
      const wrapped = wrapEmailContent(personalisedHtml, { appUrl });
      const { html, headers } = prepareEmailForSending(
        wrapped,
        sendId,
        finalToken,
        params.baseUrl,
        { trackOpens: true, trackClicks: true },
      );
      prepared.push({ sendId, userId: r.id, email: r.email, html, headers });
    }
    log("log", "batch.prepared", { batchIndex, preparedCount: prepared.length });

    // 4. Send the batch — via Send16 (per-recipient transactional) when the
    //    cutover is enabled, else Resend's batch API (inline retry loop below).
    //    Both populate the same index-aligned arrays so the reconcile is identical.
    let sendIdsFromResend: Array<{ id: string } | null> = [];
    let permissiveErrors: Array<{ index: number; message: string }> = [];
    let succeeded = false;
    let lastErrorMessage: string | null = null;

    if (useSend16) {
      ({ succeeded, sendIdsFromResend, permissiveErrors, lastErrorMessage } =
        await sendBatchViaSend16({
          params,
          batchIndex,
          prepared,
          send16ApiKey,
          send16BaseUrl,
          fromEmail,
          log,
        }));
    } else {
      // Resend path: batch send with retry on 429 / 5xx.
      const resend = new Resend(resendApiKey);
      const idempotencyKey = `campaign:${params.campaignId}:batch:${batchIndex}`;

      for (let attempt = 0; attempt <= INNER_BATCH_RETRIES; attempt++) {
        const attemptStart = Date.now();
        try {
          const response = await resend.batch.send(
            prepared.map((p) => ({
              from: fromEmail,
              to: [p.email],
              subject: params.campaignSubject,
              html: p.html,
              headers: p.headers,
            })),
            { idempotencyKey, batchValidation: "permissive" },
          );

          // Always log rate-limit telemetry so we can tune BATCH_SLEEP from
          // observability data instead of guessing.
          const rateLimitHeaders = pickRateLimitHeaders(response.headers);
          log("log", "batch.resend-call", {
            batchIndex,
            attempt,
            elapsedMs: Date.now() - attemptStart,
            idempotencyKey,
            rateLimit: rateLimitHeaders,
            hasError: response.error !== null,
          });

          if (response.error === null && response.data) {
            const data = response.data as CreateBatchSuccessResponse<{
              batchValidation: "permissive";
            }>;
            sendIdsFromResend = data.data || [];
            permissiveErrors = data.errors || [];
            succeeded = true;
            break;
          }

          // Error path — decide whether to retry.
          const err = response.error as ErrorResponse;
          lastErrorMessage = err.message;
          const isRateLimit = err.statusCode === 429;
          const isServerError =
            typeof err.statusCode === "number" && err.statusCode >= 500 && err.statusCode <= 599;
          const retryable = isRateLimit || isServerError;
          if (!retryable || attempt === INNER_BATCH_RETRIES) {
            log("error", "batch.resend-error", {
              batchIndex,
              attempt,
              statusCode: err.statusCode,
              name: err.name,
              message: err.message,
              retryable,
              outOfRetries: attempt === INNER_BATCH_RETRIES,
            });
            break;
          }

          const backoffMs = computeBackoffMs(response.headers, attempt);
          log("warn", "batch.retrying", {
            batchIndex,
            attempt,
            statusCode: err.statusCode,
            backoffMs,
            rateLimit: rateLimitHeaders,
          });
          await sleep(backoffMs);
        } catch (err) {
          lastErrorMessage = err instanceof Error ? err.message : String(err);
          if (attempt === INNER_BATCH_RETRIES) {
            log("error", "batch.threw", {
              batchIndex,
              attempt,
              error: lastErrorMessage,
            });
            break;
          }
          const backoffMs = computeBackoffMs(null, attempt);
          log("warn", "batch.threw-retrying", {
            batchIndex,
            attempt,
            error: lastErrorMessage,
            backoffMs,
          });
          await sleep(backoffMs);
        }
      }
    }

    // 5. Reconcile results into EmailSend rows. By-id updates → scoped client:
    // the chokepoint adds tenantId to each WHERE (defense-in-depth — the rows
    // already carry params.tenantId from the create above).
    const db = await getPrisma();
    if (!succeeded) {
      // `SET status=?, errorMsg=? WHERE id IN (...)` binds 2 + N params, so
      // chunk the id list to stay under D1's 100-param cap.
      for (const part of inChunks(prepared, 90)) {
        await db.emailSend.updateMany({
          where: { id: { in: part.map((p) => p.sendId) } },
          data: {
            status: "failed",
            errorMsg: (lastErrorMessage ?? "Unknown batch error").slice(0, 1000),
          },
        });
      }
      log("error", "batch.marked-all-failed", {
        batchIndex,
        failedCount: prepared.length,
        lastErrorMessage,
      });
      return { ...result, attempted: prepared.length, failed: prepared.length };
    }

    // Map per-index errors so the success path only updates the rows that
    // Resend actually accepted.
    const failedIndices = new Set(permissiveErrors.map((e) => e.index));
    const failedErrorByIndex = new Map(permissiveErrors.map((e) => [e.index, e.message]));

    // Permissive mode: data array's length equals the input length, with
    // null-ish entries at failed positions. Defensive: handle either shape.
    const sentUpdates: Promise<unknown>[] = [];
    const failedUpdates: Promise<unknown>[] = [];

    for (let i = 0; i < prepared.length; i++) {
      const p = prepared[i];
      const resendEntry = sendIdsFromResend[i];
      const resendId = resendEntry && typeof resendEntry.id === "string" ? resendEntry.id : null;
      if (failedIndices.has(i) || !resendId) {
        failedUpdates.push(
          db.emailSend.update({
            where: { id: p.sendId },
            data: {
              status: "failed",
              errorMsg: (failedErrorByIndex.get(i) ?? "Resend rejected message").slice(0, 1000),
            },
          }),
        );
      } else {
        sentUpdates.push(
          db.emailSend.update({
            where: { id: p.sendId },
            data: {
              status: "sent",
              sentAt: new Date(),
              resendMessageId: resendId,
            },
          }),
        );
      }
    }

    await Promise.all([...sentUpdates, ...failedUpdates]);

    const sentCount = sentUpdates.length;
    const failedCount = failedUpdates.length;

    log("log", "batch.reconciled", {
      batchIndex,
      attempted: prepared.length,
      sent: sentCount,
      failed: failedCount,
      permissiveErrorsCount: permissiveErrors.length,
    });

    return {
      ...result,
      attempted: prepared.length,
      sent: sentCount,
      failed: failedCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Send16 equivalent of sendBatchWithRetry. Send16 has no batch endpoint, so we
 * fan each prepared email out to the transactional API
 * (POST /api/transactional/api/send) with bounded concurrency. Returns the same
 * index-aligned BatchSendResult: `sendIdsFromResend[i]` is `{ id: <log_id> }`
 * on success or `null` on failure, with failures also listed in
 * `permissiveErrors` so the caller's reconcile marks exactly those rows failed.
 * The stored `log_id` is what Send16's outbound webhook reports back, so
 * /api/webhooks/send16 can correlate engagement events to each EmailSend.
 */
async function sendBatchViaSend16(args: {
  params: CampaignSendParams;
  batchIndex: number;
  prepared: PreparedEmail[];
  send16ApiKey: string;
  send16BaseUrl: string;
  fromEmail: string;
  log: BatchLog;
}): Promise<BatchSendResult> {
  const { params, batchIndex, prepared, send16ApiKey, send16BaseUrl, fromEmail, log } = args;

  // Bounded concurrency: friendlier to the API + rate limits than firing all
  // ~100 at once, far faster than fully sequential. Sub-chunks run in order and
  // Promise.all preserves order within each, so the flattened result array
  // lines up 1:1 with `prepared`.
  const SEND16_CONCURRENCY = 20;
  const sendIdsFromResend: Array<{ id: string } | null> = [];
  const permissiveErrors: Array<{ index: number; message: string }> = [];
  let lastErrorMessage: string | null = null;
  let anySucceeded = false;

  for (const sub of inChunks(prepared, SEND16_CONCURRENCY)) {
    const subResults = await Promise.all(
      sub.map(async (p): Promise<{ ok: true; logId: string } | { ok: false; message: string }> => {
        try {
          const res = await fetch(`${send16BaseUrl}/api/transactional/api/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${send16ApiKey}`,
              // Distinct source so usage rollups separate campaign volume from
              // the app's other transactional mail (notifications, invites).
              "X-Send16-Source": "community-campaign",
            },
            body: JSON.stringify({
              to: [p.email],
              from: fromEmail,
              subject: params.campaignSubject,
              html: p.html,
              headers: p.headers,
            }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            success?: boolean;
            data?: { log_id?: string; message_id?: string };
            error?: { message?: string };
          };
          if (!res.ok || body.success === false) {
            return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
          }
          const logId = body.data?.log_id;
          if (!logId) {
            return { ok: false, message: "Send16 accepted the send but returned no log_id" };
          }
          return { ok: true, logId };
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) };
        }
      }),
    );

    for (const r of subResults) {
      const index = sendIdsFromResend.length; // position in `prepared`
      if (r.ok) {
        sendIdsFromResend.push({ id: r.logId });
        anySucceeded = true;
      } else {
        sendIdsFromResend.push(null);
        permissiveErrors.push({ index, message: r.message.slice(0, 1000) });
        lastErrorMessage = r.message;
      }
    }
  }

  log("log", "batch.send16-sent", {
    batchIndex,
    attempted: prepared.length,
    succeeded: sendIdsFromResend.filter(Boolean).length,
    failed: permissiveErrors.length,
  });

  // `succeeded` is false only when the WHOLE batch is unusable (e.g. an auth
  // error failed every send) so the caller marks all rows failed — mirrors
  // sendBatchWithRetry. Mixed outcomes return true; per-recipient failures are
  // reconciled by the caller via permissiveErrors.
  return {
    succeeded: anySucceeded || prepared.length === 0,
    sendIdsFromResend,
    permissiveErrors,
    lastErrorMessage,
  };
}

async function queryRecipients(
  segmentQuery: string | null,
  tenantId: string,
): Promise<CampaignRecipient[]> {
  // User is GLOBAL (a person can belong to many communities), so the chokepoint
  // does NOT auto-scope it — we MUST restrict recipients to members of THIS
  // tenant by hand, else a campaign in one community emails every community's
  // users. The membership join is that restriction; getPlatformPrisma because
  // User is global. (See B1/B2 — the same pattern for every User-list read.)
  const platform = await getPlatformPrisma();
  const membership = { tenantMemberships: { some: { tenantId } } };
  if (!segmentQuery) {
    const rows = await platform.user.findMany({
      where: { email: { not: null }, isBanned: false, ...membership },
      select: { id: true, email: true, name: true },
    });
    return rows.filter(
      (r: { id: string; email: string | null; name: string | null }): r is CampaignRecipient =>
        r.email !== null,
    );
  }
  const filters = JSON.parse(segmentQuery) as Record<string, unknown>;
  const where: Record<string, unknown> = {
    email: { not: null },
    isBanned: false,
    ...membership,
  };

  if (Array.isArray(filters.cities) && filters.cities.length > 0) {
    where.city = { in: filters.cities };
  }
  if (Array.isArray(filters.roles) && filters.roles.length > 0) {
    // Filters by the global identity-level User.role, not a per-tenant role.
    // The membership join above already bounds recipients to this tenant;
    // revisit only if per-tenant role segmentation is needed.
    where.role = { in: filters.roles };
  }
  if (Array.isArray(filters.experienceLevels) && filters.experienceLevels.length > 0) {
    where.experienceLevel = { in: filters.experienceLevels };
  }
  if (filters.hasLinkedIn === true) {
    where.linkedin = { not: null };
  }
  if (filters.signupAfter) {
    where.createdAt = {
      ...((where.createdAt as object) || {}),
      gte: new Date(filters.signupAfter as string),
    };
  }
  if (filters.signupBefore) {
    where.createdAt = {
      ...((where.createdAt as object) || {}),
      lte: new Date(filters.signupBefore as string),
    };
  }
  if (filters.activityLevel === "active") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.lastSeen = { gte: thirtyDaysAgo };
  } else if (filters.activityLevel === "inactive") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.lastSeen = { lt: thirtyDaysAgo };
  }
  if (Array.isArray(filters.eventIds) && filters.eventIds.length > 0) {
    where.eventRsvps = { some: { eventId: { in: filters.eventIds }, status: "going" } };
  }
  if (Array.isArray(filters.tagIds) && filters.tagIds.length > 0) {
    where.tagAssignments = { some: { tagId: { in: filters.tagIds } } };
  }

  const rows = await platform.user.findMany({
    where,
    select: { id: true, email: true, name: true },
  });
  return rows.filter(
    (r: { id: string; email: string | null; name: string | null }): r is CampaignRecipient =>
      r.email !== null,
  );
}

function pickRateLimitHeaders(headers: Record<string, string> | null): Record<string, string> {
  if (!headers) return {};
  const keys = [
    "ratelimit-limit",
    "ratelimit-remaining",
    "ratelimit-reset",
    "retry-after",
    "x-resend-daily-quota",
    "x-resend-monthly-quota",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = headers[k] ?? headers[k.toLowerCase()];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function computeBackoffMs(headers: Record<string, string> | null, attempt: number): number {
  if (headers) {
    const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (Number.isFinite(secs) && secs > 0) {
        return Math.min(secs * 1000, 30_000);
      }
    }
    const reset = headers["ratelimit-reset"] ?? headers["RateLimit-Reset"];
    if (reset) {
      const secs = Number(reset);
      if (Number.isFinite(secs) && secs > 0) {
        return Math.min(secs * 1000, 30_000);
      }
    }
  }
  // Exponential backoff: 1s, 2s, 4s, 8s (capped).
  return Math.min(1000 * 2 ** attempt, 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
