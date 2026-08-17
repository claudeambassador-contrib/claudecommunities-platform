// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as socialRepo from "@/modules/social/repositories/socialRepository";
import type {
  SocialAccountInput,
  SocialAccountSummary,
  SocialDeps,
  SocialPostInput,
  SocialPostListOptions,
  SocialPostSummary,
  SocialPostUpdate,
} from "@/modules/social/types";
import {
  validateConnector,
  validateContent,
  validateMedia,
  validatePlatform,
} from "@/modules/social/validators";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

const DEFAULT_MAX_TEXT = 3000;

function maxText(deps?: SocialDeps): number {
  return deps?.connector?.capabilities.maxTextLength ?? DEFAULT_MAX_TEXT;
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
  await deps.connector.updateRemote({
    content: newContent,
    externalId: existing.externalId,
    scheduledFor: newScheduledAt ?? undefined,
  });
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
  const connector = validateConnector(input.connector);
  if (!connector.ok) {
    return connector;
  }
  const platform = validatePlatform(input.platform);
  if (!platform.ok) {
    return platform;
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
    connector: connector.connector,
    displayName,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    externalId: input.externalId.trim(),
    platform: platform.platform,
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

export async function createPost(
  store: TenantStore,
  actor: Actor,
  input: SocialPostInput,
  deps?: SocialDeps,
): Promise<Result<{ post: SocialPostSummary }>> {
  const perm = ensurePermission(actor, "social.edit");
  if (!perm.ok) {
    return perm;
  }
  const account = await socialRepo.getAccountById(store, input.accountId);
  if (!account.ok) {
    return account;
  }
  const mediaType = input.mediaType ?? "none";
  const mediaUrls = input.mediaUrls ?? [];
  const content = validateContent(input.content, maxText(deps));
  if (!content.ok) {
    return content;
  }
  const media = validateMedia(mediaType, mediaUrls);
  if (!media.ok) {
    return media;
  }

  const action = input.action ?? "draft";
  let status: "draft" | "scheduled" = "draft";
  let scheduledAt: Date | null = null;
  if (action === "scheduled") {
    if (!input.scheduledAt) {
      return err("bad_request", 400, "scheduledAt is required for scheduled posts");
    }
    scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return err("bad_request", 400, "Invalid scheduledAt");
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      return err("bad_request", 400, "scheduledAt must be in the future");
    }
    status = "scheduled";
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
  if (status === "scheduled" && deps?.connector?.supportsNativeScheduling && deps.workflow) {
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
    const content = validateContent(input.content, maxText(deps));
    if (!content.ok) {
      return content;
    }
  }
  if (input.mediaType !== undefined || input.mediaUrls !== undefined) {
    const media = validateMedia(
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

  return await socialRepo.updatePostById(store, id, {
    content: input.content,
    mediaType: input.mediaType,
    mediaUrls: input.mediaUrls,
    scheduledAt: parseOptionalDate(input.scheduledAt),
    status: input.status,
  });
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
    await deps.connector.deleteRemote({ externalId: existing.post.externalId });
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
      await deps.workflow.start({ postId: id });
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
  try {
    const published = await deps.connector.publish({
      content: claimed.post.content,
      mediaType: claimed.post.mediaType,
      mediaUrls: claimed.post.mediaUrls,
      scheduledFor: claimed.post.scheduledAt ? new Date(claimed.post.scheduledAt) : undefined,
    });
    const scheduledFor = claimed.post.scheduledAt ? new Date(claimed.post.scheduledAt) : null;
    const nativeSchedule =
      deps.connector.supportsNativeScheduling &&
      Boolean(scheduledFor && scheduledFor.getTime() > Date.now());
    return await socialRepo.updatePostById(store, id, {
      externalId: published.externalId,
      externalUrl: published.externalUrl,
      publishedAt: nativeSchedule ? null : new Date(),
      status: nativeSchedule ? "scheduled" : "published",
    });
  } catch (error) {
    return await socialRepo.updatePostById(store, id, {
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
    // biome-ignore lint/performance/noAwaitInLoops: cron drain is sequential
    const result = await publishExisting(store, post.id, deps);
    if (result.ok) {
      dispatched.push(post.id);
    } else {
      errors.push({ error: result.error.message, id: post.id });
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
    // biome-ignore lint/performance/noAwaitInLoops: reconcile one delegated row at a time
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
