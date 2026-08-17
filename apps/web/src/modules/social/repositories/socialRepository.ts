import { and, desc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { SocialAccountRow, SocialPostRow } from "@/modules/social/schema.tenant";
import type {
  ConnectorId,
  SocialAccountSummary,
  SocialAccountWrite,
  SocialMediaType,
  SocialPlatform,
  SocialPostListOptions,
  SocialPostStatus,
  SocialPostSummary,
  SocialPostWrite,
} from "@/modules/social/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function parseMedia(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toAccount(row: SocialAccountRow): SocialAccountSummary {
  const expiresAt = iso(row.expiresAt);
  return {
    accountType: row.accountType === "person" ? "person" : "organization",
    avatarUrl: row.avatarUrl ?? null,
    connector: row.connector as ConnectorId,
    displayName: row.displayName ?? "",
    expiresAt,
    externalId: row.externalId ?? "",
    id: row.id,
    isExpired: Boolean(row.expiresAt && row.expiresAt.getTime() < Date.now()),
    platform: row.platform as SocialPlatform,
  };
}

function toPost(row: SocialPostRow, account: SocialAccountRow | null): SocialPostSummary {
  return {
    account: {
      avatarUrl: account?.avatarUrl ?? null,
      connector: (account?.connector ?? "linkedin") as ConnectorId,
      displayName: account?.displayName ?? "",
    },
    accountId: row.accountId ?? "",
    content: row.body,
    createdAt: row.createdAt.toISOString(),
    errorMessage: row.errorMessage ?? null,
    externalId: row.externalId ?? null,
    externalUrl: row.externalUrl ?? null,
    id: row.id,
    mediaType: (row.mediaType ?? "none") as SocialMediaType,
    mediaUrls: parseMedia(row.mediaUrls ?? "[]"),
    platform: (row.platform ?? "linkedin") as SocialPlatform,
    publishedAt: iso(row.publishedAt),
    scheduledAt: iso(row.scheduledAt),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function insertAccount(
  store: TenantStore,
  input: SocialAccountWrite,
): Promise<Result<{ account: SocialAccountSummary }>> {
  const { socialAccounts } = store.tables;
  const id = newId("sac");
  await store.db.insert(socialAccounts).values({
    accessTokenEncrypted: null,
    accountType: input.accountType,
    avatarUrl: input.avatarUrl ?? null,
    connector: input.connector,
    createdAt: new Date(),
    displayName: input.displayName,
    expiresAt: input.expiresAt ?? null,
    externalId: input.externalId,
    id,
    orgId: store.orgId,
    platform: input.platform,
  });
  return getAccountById(store, id);
}

export async function listAccounts(store: TenantStore): Promise<SocialAccountSummary[]> {
  const { socialAccounts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.orgId, store.orgId))
    .orderBy(desc(socialAccounts.createdAt));
  return rows.map(toAccount);
}

export async function getAccountById(
  store: TenantStore,
  id: string,
): Promise<Result<{ account: SocialAccountSummary }>> {
  const { socialAccounts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.orgId, store.orgId), eq(socialAccounts.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Social account not found");
  }
  return ok({ account: toAccount(row) });
}

export async function deleteAccount(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getAccountById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { socialAccounts } = store.tables;
  await store.db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.orgId, store.orgId), eq(socialAccounts.id, id)));
  return ok({ success: true });
}

export async function insertPost(
  store: TenantStore,
  input: SocialPostWrite,
): Promise<Result<{ post: SocialPostSummary }>> {
  const { socialPosts } = store.tables;
  const now = new Date();
  const id = newId("spt");
  await store.db.insert(socialPosts).values({
    accountId: input.accountId,
    body: input.content,
    createdAt: now,
    createdById: input.createdById,
    errorMessage: null,
    externalId: null,
    externalUrl: null,
    id,
    mediaType: input.mediaType,
    mediaUrls: JSON.stringify(input.mediaUrls),
    orgId: store.orgId,
    platform: input.platform,
    publishAttempts: 0,
    publishedAt: null,
    scheduledAt: input.scheduledAt ?? null,
    status: input.status,
    updatedAt: now,
  });
  return getPostById(store, id);
}

async function accountRowById(
  store: TenantStore,
  accountId: string | null,
): Promise<SocialAccountRow | null> {
  if (!accountId) {
    return null;
  }
  const { socialAccounts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.orgId, store.orgId), eq(socialAccounts.id, accountId)))
    .limit(1);
  return first(rows) ?? null;
}

export async function getPostById(
  store: TenantStore,
  id: string,
): Promise<Result<{ post: SocialPostSummary }>> {
  const { socialPosts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.orgId, store.orgId), eq(socialPosts.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Post not found");
  }
  return ok({ post: toPost(row, await accountRowById(store, row.accountId)) });
}

export async function listPosts(
  store: TenantStore,
  options: SocialPostListOptions = {},
): Promise<SocialPostSummary[]> {
  const { socialPosts } = store.tables;
  const now = new Date();
  const filters = [eq(socialPosts.orgId, store.orgId)];
  if (options.status?.length) {
    filters.push(inArray(socialPosts.status, options.status));
  }
  if (options.platform) {
    filters.push(eq(socialPosts.platform, options.platform));
  }
  if (options.accountId) {
    filters.push(eq(socialPosts.accountId, options.accountId));
  }
  if (options.range === "past") {
    const past = or(
      eq(socialPosts.status, "published"),
      and(eq(socialPosts.status, "failed"), lte(socialPosts.scheduledAt, now)),
      eq(socialPosts.status, "cancelled"),
    );
    if (past) {
      filters.push(past);
    }
  } else if (options.range === "upcoming") {
    filters.push(inArray(socialPosts.status, ["draft", "scheduled", "publishing"]));
  }
  const rows = await store.db
    .select()
    .from(socialPosts)
    .where(and(...filters))
    .orderBy(desc(socialPosts.scheduledAt), desc(socialPosts.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
  return Promise.all(
    rows.map(async (row) => toPost(row, await accountRowById(store, row.accountId))),
  );
}

export async function updatePostById(
  store: TenantStore,
  id: string,
  patch: {
    content?: string;
    errorMessage?: string | null;
    externalId?: string | null;
    externalUrl?: string | null;
    mediaType?: SocialMediaType;
    mediaUrls?: string[];
    publishAttempts?: number;
    publishedAt?: Date | null;
    scheduledAt?: Date | null;
    status?: SocialPostStatus;
  },
): Promise<Result<{ post: SocialPostSummary }>> {
  const existing = await getPostById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { socialPosts } = store.tables;
  await store.db
    .update(socialPosts)
    .set({
      ...(patch.content === undefined ? {} : { body: patch.content }),
      ...(patch.errorMessage === undefined ? {} : { errorMessage: patch.errorMessage }),
      ...(patch.externalId === undefined ? {} : { externalId: patch.externalId }),
      ...(patch.externalUrl === undefined ? {} : { externalUrl: patch.externalUrl }),
      ...(patch.mediaType === undefined ? {} : { mediaType: patch.mediaType }),
      ...(patch.mediaUrls === undefined ? {} : { mediaUrls: JSON.stringify(patch.mediaUrls) }),
      ...(patch.publishAttempts === undefined ? {} : { publishAttempts: patch.publishAttempts }),
      ...(patch.publishedAt === undefined ? {} : { publishedAt: patch.publishedAt }),
      ...(patch.scheduledAt === undefined ? {} : { scheduledAt: patch.scheduledAt }),
      ...(patch.status === undefined ? {} : { status: patch.status }),
      updatedAt: new Date(),
    })
    .where(and(eq(socialPosts.orgId, store.orgId), eq(socialPosts.id, id)));
  return getPostById(store, id);
}

export async function claimForPublish(
  store: TenantStore,
  id: string,
): Promise<Result<{ post: SocialPostSummary; claimed: boolean }>> {
  const { socialPosts } = store.tables;
  const current = await getPostById(store, id);
  if (!current.ok) {
    return current;
  }
  if (
    current.post.externalId ||
    (current.post.status !== "draft" &&
      current.post.status !== "scheduled" &&
      current.post.status !== "failed")
  ) {
    return ok({ claimed: false, post: current.post });
  }
  await store.db
    .update(socialPosts)
    .set({
      errorMessage: null,
      publishAttempts: sql`${socialPosts.publishAttempts} + 1`,
      status: "publishing",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(socialPosts.orgId, store.orgId),
        eq(socialPosts.id, id),
        isNull(socialPosts.externalId),
        inArray(socialPosts.status, ["draft", "scheduled", "failed"]),
      ),
    );
  const after = await getPostById(store, id);
  if (!after.ok) {
    return after;
  }
  return ok({ claimed: after.post.status === "publishing", post: after.post });
}

export async function deletePost(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getPostById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { socialPosts } = store.tables;
  await store.db
    .delete(socialPosts)
    .where(and(eq(socialPosts.orgId, store.orgId), eq(socialPosts.id, id)));
  return ok({ success: true });
}

export async function listDueScheduled(
  store: TenantStore,
  now: Date,
): Promise<SocialPostSummary[]> {
  const { socialPosts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.orgId, store.orgId),
        eq(socialPosts.status, "scheduled"),
        isNull(socialPosts.externalId),
        lte(socialPosts.scheduledAt, now),
      ),
    )
    .limit(50);
  return Promise.all(
    rows.map(async (row) => toPost(row, await accountRowById(store, row.accountId))),
  );
}

export async function listDueDelegated(
  store: TenantStore,
  now: Date,
): Promise<SocialPostSummary[]> {
  const { socialPosts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.orgId, store.orgId),
        eq(socialPosts.status, "scheduled"),
        isNotNull(socialPosts.externalId),
        lte(socialPosts.scheduledAt, now),
      ),
    )
    .limit(100);
  return Promise.all(
    rows.map(async (row) => toPost(row, await accountRowById(store, row.accountId))),
  );
}

export async function resetStuckPublishing(store: TenantStore, cutoff: Date): Promise<number> {
  const { socialPosts } = store.tables;
  const stuck = await store.db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.orgId, store.orgId),
        eq(socialPosts.status, "publishing"),
        lte(socialPosts.updatedAt, cutoff),
      ),
    );
  for (const row of stuck) {
    // Sequential writes keep D1 updates deterministic.
    // biome-ignore lint/performance/noAwaitInLoops: reset each stuck row
    await store.db
      .update(socialPosts)
      .set({
        errorMessage: "Stuck in 'publishing' past the safety threshold",
        status: "failed",
        updatedAt: new Date(),
      })
      .where(and(eq(socialPosts.orgId, store.orgId), eq(socialPosts.id, row.id)));
  }
  return stuck.length;
}
