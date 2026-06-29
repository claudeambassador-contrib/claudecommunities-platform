/**
 * Social posts service — CRUD + publish.
 *
 * Status transitions:
 *   draft     → scheduled | publishing
 *   scheduled → publishing | cancelled
 *   publishing → published | failed
 *   failed     → publishing (manual retry)
 *
 * Publishing is idempotent at the row level: the publisher CAS-claims a
 * post by moving "draft"/"scheduled"/"failed" → "publishing", increments
 * publishAttempts, then either records the external URN or stores the
 * error and flips back to "failed".
 */

import { getEnv } from "@/lib/cf-env";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { getAccountForPublishing } from "@/lib/services/socialAccounts";
import { getProvider } from "@/lib/social/providers/registry";
import type {
  ConnectorId,
  SocialMediaType,
  SocialPlatform,
  SocialPostStatus,
  SocialPostSummary,
} from "@/lib/social/types";
import { isStorageUrl } from "@/lib/storage";
import { getTenantId, runWithTenant } from "@/lib/tenant-context";
import type { PublishPostParams } from "@/workflows/publish-post";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

export interface SocialPostInput {
  accountId: string;
  content: string;
  mediaType?: SocialMediaType;
  mediaUrls?: string[];
  /** ISO-8601. Required if you want status = "scheduled". */
  scheduledAt?: string | null;
  /**
   * - "draft":     save without scheduling
   * - "scheduled": run at scheduledAt
   * - "publish":   publish now (sync)
   */
  action?: "draft" | "scheduled" | "publish";
}

/** True when the connector runs its own scheduler (e.g. Zernio). */
function supportsNativeScheduling(connectorId: ConnectorId): boolean {
  return getProvider(connectorId).supportsNativeScheduling === true;
}

/**
 * Whether the PublishPostWorkflow binding exists on this environment.
 * Workflows are unavailable in `wrangler dev`; when absent we leave a
 * scheduled post for the cron rather than kicking a workflow that would
 * immediately flip the row to "failed".
 */
function publishWorkflowAvailable(): boolean {
  try {
    return !!(getEnv() as unknown as { PUBLISH_POST?: unknown }).PUBLISH_POST;
  } catch {
    return false;
  }
}

/** Get capabilities for a destination platform on a connector. */
function getCaps(connectorId: ConnectorId, platform: SocialPlatform) {
  const provider = getProvider(connectorId);
  const caps = provider.capabilities[platform];
  if (!caps) {
    throw new ServiceError(
      "bad_request",
      `Connector "${connectorId}" does not support platform "${platform}"`,
    );
  }
  return caps;
}

function validateContent(content: string, max: number): void {
  if (!content || content.length === 0) {
    throw new ServiceError("bad_request", "content is required");
  }
  if (content.length > max) {
    throw new ServiceError("bad_request", `content exceeds platform limit (${max} chars)`);
  }
}

function validateMedia(mediaType: SocialMediaType, mediaUrls: string[]): void {
  if (mediaType === "none") {
    if (mediaUrls.length > 0) {
      throw new ServiceError("bad_request", "mediaUrls must be empty when mediaType is 'none'");
    }
    return;
  }
  if (mediaUrls.length === 0) {
    throw new ServiceError("bad_request", `mediaType '${mediaType}' requires at least one URL`);
  }
  for (const url of mediaUrls) {
    if (!isStorageUrl(url)) {
      throw new ServiceError("bad_request", `Media URL must be a storage URL: ${url}`);
    }
  }
  if (mediaType === "image" && mediaUrls.length !== 1) {
    throw new ServiceError("bad_request", "image post must have exactly one media URL");
  }
  if (mediaType === "video" && mediaUrls.length !== 1) {
    throw new ServiceError("bad_request", "video post must have exactly one media URL");
  }
  if (mediaType === "document" && mediaUrls.length !== 1) {
    throw new ServiceError("bad_request", "document post must have exactly one media URL");
  }
  if (mediaType === "multi_image" && mediaUrls.length < 2) {
    throw new ServiceError("bad_request", "multi_image post must have at least 2 media URLs");
  }
}

function toSummary(p: {
  id: string;
  accountId: string;
  account: { displayName: string; avatarUrl: string | null; connector: string };
  platform: string;
  content: string;
  mediaType: string;
  mediaUrls: string;
  status: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SocialPostSummary {
  let mediaUrls: string[] = [];
  try {
    mediaUrls = JSON.parse(p.mediaUrls) as string[];
  } catch {
    mediaUrls = [];
  }
  return {
    id: p.id,
    accountId: p.accountId,
    account: {
      displayName: p.account.displayName,
      avatarUrl: p.account.avatarUrl,
      connector: p.account.connector as ConnectorId,
    },
    platform: p.platform as SocialPlatform,
    content: p.content,
    mediaType: p.mediaType as SocialMediaType,
    mediaUrls,
    status: p.status as SocialPostStatus,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    externalUrl: p.externalUrl,
    errorMessage: p.errorMessage,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const ACCOUNT_INCLUDE = {
  account: { select: { displayName: true, avatarUrl: true, connector: true } },
} as const;

export interface ListOptions {
  /** "past" | "upcoming" | "all" — defaults to "all". */
  range?: "past" | "upcoming" | "all";
  /** Filter by status. */
  status?: SocialPostStatus[];
  /** Filter by platform. */
  platform?: SocialPlatform;
  /** Filter by account. */
  accountId?: string;
  /** Pagination. Defaults: 50 items. */
  limit?: number;
  cursor?: string;
}

export async function listPosts(
  actor: ActorLike,
  options: ListOptions = {},
): Promise<SocialPostSummary[]> {
  ensurePermission(actor, "social.view");
  const db = await getPrisma();
  const now = new Date();
  const where: Record<string, unknown> = {};
  if (options.status?.length) where.status = { in: options.status };
  if (options.platform) where.platform = options.platform;
  if (options.accountId) where.accountId = options.accountId;
  if (options.range === "past") {
    where.OR = [
      { status: "published" },
      { status: "failed", scheduledAt: { lt: now } },
      { status: "cancelled" },
    ];
  } else if (options.range === "upcoming") {
    where.OR = [{ status: "draft" }, { status: "scheduled" }, { status: "publishing" }];
  }
  const rows = await db.socialPost.findMany({
    where,
    include: ACCOUNT_INCLUDE,
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(options.limit ?? 50, 200),
  });
  return rows.map(toSummary);
}

export async function getPost(actor: ActorLike, id: string): Promise<SocialPostSummary> {
  ensurePermission(actor, "social.view");
  const db = await getPrisma();
  const row = await db.socialPost.findUnique({
    where: { id },
    include: ACCOUNT_INCLUDE,
  });
  if (!row) throw new ServiceError("not_found", "Post not found");
  return toSummary(row);
}

export async function createPost(
  actor: ActorLike,
  input: SocialPostInput,
): Promise<SocialPostSummary> {
  ensurePermission(actor, "social.edit");
  const db = await getPrisma();

  const account = await db.socialAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new ServiceError("not_found", "Social account not found");

  const caps = getCaps(account.connector as ConnectorId, account.platform as SocialPlatform);
  const mediaType = (input.mediaType ?? "none") as SocialMediaType;
  const mediaUrls = input.mediaUrls ?? [];

  validateContent(input.content, caps.maxTextLength);
  validateMedia(mediaType, mediaUrls);

  const action = input.action ?? "draft";
  let status: SocialPostStatus = "draft";
  let scheduledAt: Date | null = null;

  if (action === "scheduled") {
    if (!input.scheduledAt) {
      throw new ServiceError("bad_request", "scheduledAt is required for scheduled posts");
    }
    scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new ServiceError("bad_request", "Invalid scheduledAt");
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      throw new ServiceError("bad_request", "scheduledAt must be in the future");
    }
    status = "scheduled";
  }
  // Note: action === "publish" still creates the row as "draft" here — the
  // status flip to "publishing" happens inside publishExisting's atomic CAS
  // below. Setting it to "publishing" up front would defeat that CAS (its
  // WHERE clause only matches draft|scheduled|failed) and the publish call
  // would silently no-op, leaving the row stuck.

  const created = await db.socialPost.create({
    data: {
      accountId: account.id,
      platform: account.platform,
      content: input.content,
      mediaType,
      mediaUrls: JSON.stringify(mediaUrls),
      status,
      scheduledAt,
      createdById: actor.id,
    },
    include: ACCOUNT_INCLUDE,
  });

  if (action === "publish") {
    return publishExisting(created.id);
  }
  // Connectors with their own scheduler get the post handed off immediately
  // (as a scheduled post on their side) instead of waiting for our cron.
  // The workflow passes scheduledFor through and finalizes the row back to
  // "scheduled" with an externalId. If the binding is missing (dev), fall
  // back to the cron path by leaving it untouched.
  if (
    status === "scheduled" &&
    supportsNativeScheduling(account.connector as ConnectorId) &&
    publishWorkflowAvailable()
  ) {
    return publishExisting(created.id);
  }
  return toSummary(created);
}

export interface UpdatePostInput {
  content?: string;
  mediaType?: SocialMediaType;
  mediaUrls?: string[];
  scheduledAt?: string | null;
  status?: Extract<SocialPostStatus, "draft" | "scheduled" | "cancelled">;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear update flow branching across draft/scheduled/delegated states and media handling — splitting it would scatter the single-post transaction logic
export async function updatePost(
  actor: ActorLike,
  id: string,
  input: UpdatePostInput,
): Promise<SocialPostSummary> {
  ensurePermission(actor, "social.edit");
  const db = await getPrisma();
  const existing = await db.socialPost.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!existing) throw new ServiceError("not_found", "Post not found");
  if (existing.status === "published" || existing.status === "publishing") {
    throw new ServiceError("conflict", `Cannot edit a ${existing.status} post`);
  }

  const connector = existing.account.connector as ConnectorId;
  const caps = getCaps(connector, existing.platform as SocialPlatform);
  if (input.content !== undefined) {
    validateContent(input.content, caps.maxTextLength);
  }
  if (input.mediaType !== undefined || input.mediaUrls !== undefined) {
    const mediaType = (input.mediaType ??
      (existing.mediaType as SocialMediaType)) as SocialMediaType;
    const mediaUrls = input.mediaUrls ?? (JSON.parse(existing.mediaUrls) as string[]);
    validateMedia(mediaType, mediaUrls);
  }

  // A scheduled post already handed off to a native scheduler (Zernio) lives
  // on the connector now. We can push content/time edits through to it, but
  // the connector's update endpoint doesn't accept media changes — and
  // un-scheduling (status → draft/cancelled) has no remote equivalent. So we
  // allow content/schedule edits and reject the rest with a clear path.
  const provider = getProvider(connector);
  if (existing.status === "scheduled" && existing.externalId && provider.updateRemote) {
    if (input.status !== undefined && input.status !== "scheduled") {
      throw new ServiceError(
        "conflict",
        "This post is already scheduled with Zernio. Delete it to un-schedule, rather than changing its status.",
      );
    }
    const mediaChanged =
      (input.mediaType !== undefined && input.mediaType !== existing.mediaType) ||
      (input.mediaUrls !== undefined && JSON.stringify(input.mediaUrls) !== existing.mediaUrls);
    if (mediaChanged) {
      throw new ServiceError(
        "conflict",
        "Media can't be changed on a post already scheduled with Zernio. Delete it and create a new one.",
      );
    }

    const newContent = input.content ?? existing.content;
    const newScheduledAt =
      input.scheduledAt !== undefined
        ? input.scheduledAt
          ? new Date(input.scheduledAt)
          : existing.scheduledAt
        : existing.scheduledAt;

    const account = await getAccountForPublishing(existing.accountId);
    await provider.updateRemote({
      externalId: existing.externalId,
      accessToken: account.accessToken,
      content: newContent,
      scheduledFor: newScheduledAt ?? undefined,
    });

    const row = await db.socialPost.update({
      where: { id },
      data: { content: newContent, scheduledAt: newScheduledAt },
      include: ACCOUNT_INCLUDE,
    });
    return toSummary(row);
  }

  const data: Record<string, unknown> = {};
  if (input.content !== undefined) data.content = input.content;
  if (input.mediaType !== undefined) data.mediaType = input.mediaType;
  if (input.mediaUrls !== undefined) data.mediaUrls = JSON.stringify(input.mediaUrls);
  if (input.scheduledAt !== undefined) {
    data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  }
  if (input.status !== undefined) data.status = input.status;

  const row = await db.socialPost.update({
    where: { id },
    data,
    include: ACCOUNT_INCLUDE,
  });

  // Scheduling an existing (non-delegated) post via PATCH — e.g. scheduling a
  // draft from the composer — hands it off to a native scheduler immediately,
  // matching the create path. `existing.externalId` is null here (delegated
  // posts are handled by the branch above).
  if (
    input.status === "scheduled" &&
    supportsNativeScheduling(connector) &&
    publishWorkflowAvailable()
  ) {
    return publishExisting(id);
  }
  return toSummary(row);
}

export async function deletePost(actor: ActorLike, id: string): Promise<{ success: true }> {
  ensurePermission(actor, "social.edit");
  const db = await getPrisma();
  const post = await db.socialPost.findUnique({ where: { id }, include: { account: true } });
  if (!post) throw new ServiceError("not_found", "Post not found");

  // A scheduled post handed off to a native scheduler (Zernio) lives on the
  // connector now — cancel it there FIRST. If the remote delete fails we keep
  // the local row so the user knows it's still scheduled and can retry, rather
  // than orphaning a post that fires with no local record. (Published posts
  // also carry an externalId but can't be deleted on the connector — those
  // just drop locally.)
  const provider = getProvider(post.account.connector as ConnectorId);
  if (post.status === "scheduled" && post.externalId && provider.deleteRemote) {
    const account = await getAccountForPublishing(post.accountId);
    await provider.deleteRemote({
      externalId: post.externalId,
      accessToken: account.accessToken,
    });
  }

  await db.socialPost.delete({ where: { id } });
  return { success: true };
}

/**
 * Atomic claim + kick off the PublishPostWorkflow. The workflow takes the
 * row from "publishing" to either "published" or "failed" with checkpointed
 * steps and built-in retry, so a Worker death mid-publish no longer leaves
 * the row stuck.
 *
 * Returns the row in its post-claim state ("publishing"). The UI's refresh
 * loop will catch the terminal status once the workflow finishes.
 *
 * Used by:
 *  - "publish now" admin action (via createPost or the publish API route)
 *  - the cron route that drains due "scheduled" posts
 *  - manual retry of "failed" posts
 */
export async function publishExisting(id: string): Promise<SocialPostSummary> {
  // Atomic CAS — wins for exactly one caller per attempt. `externalId: null`
  // refuses to re-publish a post already handed off to a native scheduler
  // (status="scheduled" + externalId): re-firing it would double-post on the
  // connector. Every legitimately (re)publishable state — draft, non-delegated
  // scheduled, failed — has a null externalId, so this only excludes delegated
  // rows.
  const db = await getPrisma();
  const claim = await db.socialPost.updateMany({
    where: { id, status: { in: ["draft", "scheduled", "failed"] }, externalId: null },
    data: { status: "publishing", errorMessage: null, publishAttempts: { increment: 1 } },
  });

  const row = await db.socialPost.findUnique({ where: { id }, include: ACCOUNT_INCLUDE });
  if (!row) throw new ServiceError("not_found", "Post not found");

  if (claim.count === 0) {
    // Already in flight or terminal — return current state, don't double-fire.
    return toSummary(row);
  }

  await kickoffPublishWorkflow(id, row.publishAttempts);
  return toSummary(row);
}

/**
 * Kick off the PublishPostWorkflow for a given post. The workflow handles
 * preparing the request, calling the provider with retries, and writing
 * the terminal status.
 *
 * Instance id is `${postId}-${attempt}` so re-publishing a failed post (a
 * fresh attempt) gets its own instance without colliding with the previous
 * one. Workflows reject duplicate ids, which is exactly the guard we want.
 */
async function kickoffPublishWorkflow(postId: string, attempt: number): Promise<void> {
  const env = getEnv() as unknown as { PUBLISH_POST?: Workflow<PublishPostParams> };
  // Resolve the tenant from whatever scope this runs in: the request header
  // (admin "publish now" / MCP / retry) or the per-row runWithTenant the cron
  // drain wraps each due post in. Baked into the payload so the workflow can
  // re-establish it off-request. publishExisting already touched getPrisma(),
  // so a tenant is guaranteed in scope here.
  const tenantId = await getTenantId();
  const db = await getPrisma();
  if (!env.PUBLISH_POST) {
    // Roll back the claim so the post isn't permanently stuck in
    // "publishing" when the binding is missing (local dev).
    await db.socialPost
      .update({
        where: { id: postId },
        data: {
          status: "failed",
          errorMessage:
            "PUBLISH_POST workflow binding is not configured on this environment (workflows are unavailable in `wrangler dev`).",
        },
      })
      .catch(() => {});
    throw new ServiceError(
      "unavailable",
      "PUBLISH_POST workflow binding is not configured on this environment",
    );
  }
  try {
    await env.PUBLISH_POST.create({
      id: `${postId}-${attempt}`,
      params: { postId, tenantId },
    });
  } catch (err) {
    // Dispatch itself failed — roll the claim back so the row isn't stuck
    // in "publishing" with no workflow actually running. The 30-min
    // resetStuckPublishing net would catch it eventually, but the user
    // would see a frozen-looking row in the meantime.
    const message = err instanceof Error ? err.message : String(err);
    await db.socialPost
      .update({
        where: { id: postId },
        data: {
          status: "failed",
          errorMessage: `Failed to dispatch publish workflow: ${message}`.slice(0, 1000),
        },
      })
      .catch(() => {});
    throw err;
  }
}

/**
 * Safety net: reset rows stuck in "publishing" for longer than the workflow
 * could plausibly need. Workflows make this rare — only triggers if the
 * workflow itself couldn't persist its terminal status (e.g. D1 was down
 * during finalize and all retries failed).
 *
 * Threshold is generous because workflow steps retry with backoff and a
 * single attempt can legitimately take a few minutes.
 *
 * Called from the publish-scheduled-posts cron route on every tick.
 */
export async function resetStuckPublishing(maxAgeMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  // Cron context (no tenant). This is a deliberately tenant-AGNOSTIC system
  // safety net — any stuck row in any tenant must be reset — so it runs on the
  // unscoped platform client. It exposes no cross-tenant DATA (it only flips a
  // status by a tenant-independent predicate), unlike the per-row publish path
  // below which re-establishes each row's own tenant scope.
  const platform = await getPlatformPrisma();
  const result = await platform.socialPost.updateMany({
    where: { status: "publishing", updatedAt: { lt: cutoff } },
    data: {
      status: "failed",
      errorMessage: `Stuck in 'publishing' for over ${maxAgeMinutes} minutes — workflow likely failed to persist its terminal status. Retry or check the workflow logs.`,
    },
  });
  if (result.count > 0) {
    console.warn(`[social] reset ${result.count} stuck publishing post(s)`);
  }
  return result.count;
}

/**
 * Drain all "scheduled" posts whose scheduledAt is due — kicks off one
 * workflow per due post. Returns the ids it dispatched so the cron logs
 * are useful. Actual publish outcomes show up as the workflows finish.
 */
export async function publishDueScheduled(now: Date = new Date()): Promise<{
  dispatched: string[];
  errors: Array<{ id: string; error: string }>;
}> {
  // Cron context (no tenant): the platform client is the ONLY way to SEE due
  // rows across every tenant. We read just {id, tenantId}; each post is then
  // published under its OWN tenant scope via runWithTenant below, so the
  // unscoped surface is the scan alone.
  const platform = await getPlatformPrisma();
  const TAKE = 50;
  const due = await platform.socialPost.findMany({
    // externalId: null excludes posts already handed off to a native scheduler
    // (Zernio) — those fire on the connector's side, and re-publishing them
    // here would double-post. reconcileDelegatedScheduled handles their final
    // status flip instead.
    where: { status: "scheduled", scheduledAt: { lte: now }, externalId: null },
    take: TAKE,
    select: { id: true, tenantId: true },
  });
  // TAKE is a per-tick budget across ALL tenants now, not per-tenant. Surface
  // truncation so a backlog (or one busy tenant starving others) isn't silent.
  if (due.length === TAKE) {
    console.warn(
      `[social] publishDueScheduled hit the ${TAKE}-row cap this tick (cross-tenant) — remaining due posts wait for the next tick`,
    );
  }
  const dispatched: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];
  for (const { id, tenantId } of due) {
    try {
      // Re-establish the post's own tenant so publishExisting's scoped CAS
      // claim + the workflow payload bind to the right community.
      await runWithTenant(tenantId, () => publishExisting(id));
      dispatched.push(id);
    } catch (err) {
      errors.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { dispatched, errors };
}

/**
 * Reconcile posts that were handed off to a native scheduler (Zernio) and
 * whose scheduled time has now passed — flip them from "scheduled" to
 * "published" so they leave the admin's "upcoming" list.
 *
 * This is optimistic: we don't poll the connector, so a connector-side
 * failure would still show "published" here. The stored externalUrl links
 * back to the connector's post for the admin to verify, which is strictly
 * less confusing than a delivered post sitting in "upcoming" forever.
 *
 * Called from the cron alongside publishDueScheduled. Delegated posts are
 * identified by status="scheduled" AND externalId set (normal scheduled posts
 * have no externalId until they publish).
 */
export async function reconcileDelegatedScheduled(now: Date = new Date()): Promise<number> {
  // Cron context: platform client for the cross-tenant SCAN only (read
  // {id, scheduledAt, tenantId}); each status-flip write runs under the row's
  // own tenant scope so the only unscoped surface stays the scan.
  const platform = await getPlatformPrisma();
  const TAKE = 100;
  const rows = await platform.socialPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now }, NOT: { externalId: null } },
    take: TAKE,
    select: { id: true, scheduledAt: true, tenantId: true },
  });
  if (rows.length === TAKE) {
    console.warn(
      `[social] reconcileDelegatedScheduled hit the ${TAKE}-row cap this tick (cross-tenant) — remaining delegated posts reconcile next tick`,
    );
  }
  for (const r of rows) {
    await runWithTenant(r.tenantId, async () => {
      await (await getPrisma()).socialPost.update({
        where: { id: r.id },
        data: { status: "published", publishedAt: r.scheduledAt ?? now },
      });
    });
  }
  if (rows.length > 0) {
    // biome-ignore lint/suspicious/noConsole: operational summary from the cron reconcile path; surfaced in Worker logs
    console.log(`[social] reconciled ${rows.length} delegated scheduled post(s) to 'published'`);
  }
  return rows.length;
}
