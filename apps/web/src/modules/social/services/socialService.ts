import type { z } from "zod";

// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as socialRepo from "@/modules/social/repositories/socialRepository";
import {
  connectorIdInput,
  contentInput,
  socialMediaInput,
  socialPlatformInput,
} from "@/modules/social/schemas";
import type {
  SocialAccountInput,
  SocialAccountSummary,
  SocialConnector,
  SocialDeps,
  SocialMediaType,
  SocialPostAction,
  SocialPostInput,
  SocialPostListOptions,
  SocialPostSummary,
  SocialPostUpdate,
} from "@/modules/social/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Empty, Result } from "@/shared/http/errors";

const DEFAULT_MAX_TEXT = 3000;

function maxText(deps?: SocialDeps): number {
  return deps?.connector?.capabilities.maxTextLength ?? DEFAULT_MAX_TEXT;
}

function badInput<T>(parsed: z.SafeParseError<T>): Result<never> {
  return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
}

function checkContent(content: string, max: number): Result<Empty> {
  const parsed = contentInput(max).safeParse(content);
  return parsed.success ? ok({}) : badInput(parsed);
}

function checkMedia(mediaType: SocialMediaType, mediaUrls: string[]): Result<Empty> {
  const parsed = socialMediaInput.safeParse({ mediaType, mediaUrls });
  return parsed.success ? ok({}) : badInput(parsed);
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ? new Date(value) : null;
}

function parseExistingDate(value: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

async function updateDelegatedPost(
  store: TenantStore,
  id: string,
  existing: SocialPostSummary,
  input: SocialPostUpdate,
  deps: SocialDeps,
): Promise<Result<{ post: SocialPostSummary }>> {
  if (!(deps.connector?.updateRemote && existing.externalId)) {
    return err("bad_request", 400, "Connector cannot update a delegated post");
  }
  if (input.status !== undefined && input.status !== "scheduled") {
    return err(
      "conflict",
      409,
      "This post is already scheduled with the connector. Delete it to un-schedule.",
    );
  }
  const mediaChanged =
    (input.mediaType !== undefined && input.mediaType !== existing.mediaType) ||
    (input.mediaUrls !== undefined &&
      JSON.stringify(input.mediaUrls) !== JSON.stringify(existing.mediaUrls));
  if (mediaChanged) {
    return err(
      "conflict",
      409,
      "Media can't be changed on a post already scheduled with the connector.",
    );
  }
  const newContent = input.content ?? existing.content;
  const newScheduledAt =
    parseOptionalDate(input.scheduledAt) ?? parseExistingDate(existing.scheduledAt);
  try {
    await deps.connector.updateRemote({
      content: newContent,
      externalId: existing.externalId,
      scheduledFor: newScheduledAt ?? undefined,
    });
  } catch (error) {
    return err(
      "bad_gateway",
      502,
      error instanceof Error ? error.message : "Failed to update the remote post",
    );
  }
  return await socialRepo.updatePostById(store, id, {
    content: newContent,
    scheduledAt: newScheduledAt ?? null,
  });
}

export async function connectAccount(
  store: TenantStore,
  actor: Actor,
  input: SocialAccountInput,
): Promise<Result<{ account: SocialAccountSummary }>> {
  const perm = ensurePermission(actor, "social.manage");
  if (!perm.ok) {
    return perm;
  }
  const connector = connectorIdInput.safeParse(input.connector);
  if (!connector.success) {
    return badInput(connector);
  }
  const platform = socialPlatformInput.safeParse(input.platform);
  if (!platform.success) {
    return badInput(platform);
  }
  const displayName = input.displayName.trim();
  if (!displayName) {
    return err("bad_request", 400, "displayName is required");
  }
  if (!input.externalId.trim()) {
    return err("bad_request", 400, "externalId is required");
  }
  return await socialRepo.insertAccount(store, {
    accountType: input.accountType ?? "organization",
    avatarUrl: input.avatarUrl ?? null,
    connector: connector.data,
    displayName,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    externalId: input.externalId.trim(),
    platform: platform.data,
  });
}

export async function listAccounts(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ accounts: SocialAccountSummary[] }>> {
  const perm = ensurePermission(actor, "social.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ accounts: await socialRepo.listAccounts(store) });
}

export async function disconnectAccount(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "social.manage");
  if (!perm.ok) {
    return perm;
  }
  return await socialRepo.deleteAccount(store, id);
}

export async function listPosts(
  store: TenantStore,
  actor: Actor,
  options: SocialPostListOptions = {},
): Promise<Result<{ posts: SocialPostSummary[] }>> {
  const perm = ensurePermission(actor, "social.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ posts: await socialRepo.listPosts(store, options) });
}

export async function getPost(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ post: SocialPostSummary }>> {
  const perm = ensurePermission(actor, "social.view");
  if (!perm.ok) {
    return perm;
  }
  return await socialRepo.getPostById(store, id);
}

function ensureCreatePostPermission(actor: Actor, action: SocialPostAction): Result<Empty> {
  const perm = ensurePermission(actor, "social.edit");
  if (!perm.ok) {
    return perm;
  }
  if (action === "publish") {
    return ensurePermission(actor, "social.publish");
  }
  return ok({});
}

function resolveScheduledAt(scheduledAtInput: string | null | undefined): Result<{
  scheduledAt: Date | null;
  status: "draft" | "scheduled";
}> {
  if (!scheduledAtInput) {
    return err("bad_request", 400, "scheduledAt is required for scheduled posts");
  }
  const scheduledAt = new Date(scheduledAtInput);
  if (Number.isNaN(scheduledAt.getTime())) {
    return err("bad_request", 400, "Invalid scheduledAt");
  }
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    return err("bad_request", 400, "scheduledAt must be in the future");
  }
  return ok({ scheduledAt, status: "scheduled" });
}

export async function createPost(
  store: TenantStore,
  actor: Actor,
  input: SocialPostInput,
  deps?: SocialDeps,
): Promise<Result<{ post: SocialPostSummary }>> {
  const action = input.action ?? "draft";
  const perm = ensureCreatePostPermission(actor, action);
  if (!perm.ok) {
    return perm;
  }
  const account = await socialRepo.getAccountById(store, input.accountId);
  if (!account.ok) {
    return account;
  }
  const mediaType = input.mediaType ?? "none";
  const mediaUrls = input.mediaUrls ?? [];
  const content = checkContent(input.content, maxText(deps));
  if (!content.ok) {
    return content;
  }
  const media = checkMedia(mediaType, mediaUrls);
  if (!media.ok) {
    return media;
  }

  let status: "draft" | "scheduled" = "draft";
  let scheduledAt: Date | null = null;
  if (action === "scheduled") {
    const resolved = resolveScheduledAt(input.scheduledAt);
    if (!resolved.ok) {
      return resolved;
    }
    ({ status, scheduledAt } = resolved);
  }

  const created = await socialRepo.insertPost(store, {
    accountId: account.account.id,
    content: input.content,
    createdById: actor.id,
    mediaType,
    mediaUrls,
    platform: account.account.platform,
    scheduledAt,
    status,
  });
  if (!created.ok) {
    return created;
  }
  if (action === "publish") {
    return await publishExisting(store, created.post.id, deps);
  }
  if (status === "scheduled" && deps?.connector?.supportsNativeScheduling) {
    return await publishExisting(store, created.post.id, deps);
  }
  return created;
}

export async function updatePost(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: SocialPostUpdate,
  deps?: SocialDeps,
): Promise<Result<{ post: SocialPostSummary }>> {
  const perm = ensurePermission(actor, "social.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await socialRepo.getPostById(store, id);
  if (!existing.ok) {
    return existing;
  }
  if (existing.post.status === "published" || existing.post.status === "publishing") {
    return err("conflict", 409, `Cannot edit a ${existing.post.status} post`);
  }
  if (input.content !== undefined) {
    const content = checkContent(input.content, maxText(deps));
    if (!content.ok) {
      return content;
    }
  }
  if (input.mediaType !== undefined || input.mediaUrls !== undefined) {
    const media = checkMedia(
      input.mediaType ?? existing.post.mediaType,
      input.mediaUrls ?? existing.post.mediaUrls,
    );
    if (!media.ok) {
      return media;
    }
  }

  if (
    existing.post.status === "scheduled" &&
    existing.post.externalId &&
    deps?.connector?.updateRemote
  ) {
    return await updateDelegatedPost(store, id, existing.post, input, deps);
  }

  const updated = await socialRepo.updatePostById(store, id, {
    content: input.content,
    mediaType: input.mediaType,
    mediaUrls: input.mediaUrls,
    scheduledAt: parseOptionalDate(input.scheduledAt),
    status: input.status,
  });
  if (updated.ok && input.status === "scheduled" && deps?.connector?.supportsNativeScheduling) {
    return await publishExisting(store, id, deps);
  }
  return updated;
}

export async function deletePost(
  store: TenantStore,
  actor: Actor,
  id: string,
  deps?: SocialDeps,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "social.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await socialRepo.getPostById(store, id);
  if (!existing.ok) {
    return existing;
  }
  if (
    existing.post.status === "scheduled" &&
    existing.post.externalId &&
    deps?.connector?.deleteRemote
  ) {
    try {
      await deps.connector.deleteRemote({ externalId: existing.post.externalId });
    } catch (error) {
      return err(
        "bad_gateway",
        502,
        error instanceof Error ? error.message : "Failed to delete the remote post",
      );
    }
  }
  return await socialRepo.deletePost(store, id);
}

export async function publishExisting(
  store: TenantStore,
  id: string,
  deps?: SocialDeps,
): Promise<Result<{ post: SocialPostSummary }>> {
  const claimed = await socialRepo.claimForPublish(store, id);
  if (!claimed.ok) {
    return claimed;
  }
  if (!claimed.claimed) {
    return ok({ post: claimed.post });
  }
  if (deps?.workflow) {
    try {
      await deps.workflow.start({ attempt: claimed.attempt, postId: id });
      return await socialRepo.getPostById(store, id);
    } catch (error) {
      return await socialRepo.updatePostById(store, id, {
        errorMessage:
          error instanceof Error ? error.message : "Failed to dispatch publish workflow",
        status: "failed",
      });
    }
  }
  if (!deps?.connector) {
    return await socialRepo.updatePostById(store, id, {
      errorMessage: "PUBLISH_POST workflow binding is not configured on this environment",
      status: "failed",
    });
  }
  return completeClaimedPublish(store, claimed.post, deps.connector);
}

export async function completeClaimedPublish(
  store: TenantStore,
  post: SocialPostSummary,
  connector: SocialConnector,
): Promise<Result<{ post: SocialPostSummary }>> {
  try {
    const published = await connector.publish({
      content: post.content,
      mediaType: post.mediaType,
      mediaUrls: post.mediaUrls,
      scheduledFor: post.scheduledAt ? new Date(post.scheduledAt) : undefined,
    });
    const scheduledFor = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const nativeSchedule =
      connector.supportsNativeScheduling &&
      Boolean(scheduledFor && scheduledFor.getTime() > Date.now());
    return await socialRepo.updatePostById(store, post.id, {
      externalId: published.externalId,
      externalUrl: published.externalUrl,
      publishedAt: nativeSchedule ? null : new Date(),
      status: nativeSchedule ? "scheduled" : "published",
    });
  } catch (error) {
    return await socialRepo.updatePostById(store, post.id, {
      errorMessage: error instanceof Error ? error.message : "Publish failed",
      status: "failed",
    });
  }
}

export async function publishDueScheduled(
  store: TenantStore,
  now: Date = new Date(),
  deps?: SocialDeps,
): Promise<Result<{ dispatched: string[]; errors: { error: string; id: string }[] }>> {
  const due = await socialRepo.listDueScheduled(store, now);
  const dispatched: string[] = [];
  const errors: { error: string; id: string }[] = [];
  for (const post of due) {
    // Sequential claim+publish so two due rows cannot interleave CAS.
    // oxlint-disable-next-line no-await-in-loop -- cron drain is sequential
    const result = await publishExisting(store, post.id, deps);
    if (result.ok && result.post.status !== "failed") {
      dispatched.push(post.id);
    } else {
      const message = result.ok
        ? (result.post.errorMessage ?? "Publish failed")
        : (result.error.message ?? "Publish failed");
      errors.push({ error: message, id: post.id });
    }
  }
  return ok({ dispatched, errors });
}

export async function reconcileDelegatedScheduled(
  store: TenantStore,
  now: Date = new Date(),
): Promise<Result<{ count: number }>> {
  const due = await socialRepo.listDueDelegated(store, now);
  let count = 0;
  for (const post of due) {
    // Sequential status flips keep D1 writes deterministic.
    // oxlint-disable-next-line no-await-in-loop -- reconcile one delegated row at a time
    const updated = await socialRepo.updatePostById(store, post.id, {
      publishedAt: post.scheduledAt ? new Date(post.scheduledAt) : now,
      status: "published",
    });
    if (updated.ok) {
      count += 1;
    }
  }
  return ok({ count });
}

export async function resetStuckPublishing(
  store: TenantStore,
  maxAgeMinutes = 30,
): Promise<Result<{ count: number }>> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return ok({ count: await socialRepo.resetStuckPublishing(store, cutoff) });
}

/** Cron-facing: due scheduled posts with no externalId (native-scheduled excluded). */
export async function listDuePublishable(
  store: TenantStore,
  now: Date,
): Promise<Result<{ posts: { id: string }[] }>> {
  const posts = await socialRepo.listDueScheduled(store, now);
  return ok({ posts: posts.map((p) => ({ id: p.id })) });
}

/** Workflow-facing: atomically claim a post for publishing. */
export async function claimPostForPublish(
  store: TenantStore,
  postId: string,
): Promise<Result<{ attempt: number; claimed: boolean }>> {
  const result = await socialRepo.claimForPublish(store, postId);
  if (!result.ok) {
    return result;
  }
  return ok({ attempt: result.attempt, claimed: result.claimed });
}

/** Workflow-facing: terminal failure transition, one place. */
export async function markPublishFailed(
  store: TenantStore,
  postId: string,
  message: string,
): Promise<Result<Empty>> {
  const updated = await socialRepo.updatePostById(store, postId, {
    errorMessage: message,
    status: "failed",
  });
  if (!updated.ok) {
    return updated;
  }
  return ok({});
}

/** Workflow-facing: fetch a post without an actor/permission check (system-triggered). */
export async function getPostForPublish(
  store: TenantStore,
  postId: string,
): Promise<Result<{ post: SocialPostSummary }>> {
  return await socialRepo.getPostById(store, postId);
}

export async function countScheduled(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ count: number }>> {
  const perm = ensurePermission(actor, "social.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ count: await socialRepo.countByStatus(store, "scheduled") });
}
