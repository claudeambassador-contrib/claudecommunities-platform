import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import type { CommentRow, PostRow, SpaceRow } from "@/modules/community/schema.tenant";
import type {
  CommentNode,
  PostDetail,
  ReactionSummary,
  SpaceDetail,
} from "@/modules/community/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

async function spaceById(store: TenantStore, id: string): Promise<SpaceRow | null> {
  const { spaces } = store.tables;
  const rows = await store.db
    .select()
    .from(spaces)
    .where(and(eq(spaces.orgId, store.orgId), eq(spaces.id, id)))
    .limit(1);
  return first(rows) ?? null;
}

async function commentCount(store: TenantStore, postId: string): Promise<number> {
  const { comments } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.orgId, store.orgId), eq(comments.postId, postId)));
  const [row] = rows;
  return Number(row?.n ?? 0);
}

async function reactionCount(store: TenantStore, postId: string): Promise<number> {
  const { reactions } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(reactions)
    .where(and(eq(reactions.orgId, store.orgId), eq(reactions.postId, postId)));
  const [row] = rows;
  return Number(row?.n ?? 0);
}

async function isBookmarked(store: TenantStore, postId: string, userId?: string): Promise<boolean> {
  if (!userId) {
    return false;
  }
  const { bookmarks } = store.tables;
  const rows = await store.db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.orgId, store.orgId),
        eq(bookmarks.postId, postId),
        eq(bookmarks.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(first(rows));
}

async function toPostDetail(
  store: TenantStore,
  row: PostRow,
  viewerId?: string,
): Promise<PostDetail> {
  const space = row.spaceId ? await spaceById(store, row.spaceId) : null;
  return {
    authorId: row.authorUserId,
    commentCount: await commentCount(store, row.id),
    content: row.body,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    isBookmarked: await isBookmarked(store, row.id, viewerId),
    isPinned: Boolean(row.isPinned),
    mediaType: row.mediaType ?? null,
    mediaUrl: row.mediaUrl ?? null,
    reactionCount: await reactionCount(store, row.id),
    space: space
      ? { color: space.color ?? null, id: space.id, name: space.name, slug: space.slug }
      : null,
    title: row.title ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSpaces(store: TenantStore): Promise<SpaceDetail[]> {
  const { spaces, posts } = store.tables;
  const rows = await store.db
    .select()
    .from(spaces)
    .where(eq(spaces.orgId, store.orgId))
    .orderBy(asc(spaces.sortOrder), asc(spaces.name));
  return Promise.all(
    rows.map(async (row) => {
      const counts = await store.db
        .select({ n: sql<number>`count(*)` })
        .from(posts)
        .where(and(eq(posts.orgId, store.orgId), eq(posts.spaceId, row.id)));
      const [countRow] = counts;
      return {
        color: row.color ?? null,
        description: row.description ?? null,
        icon: row.icon ?? null,
        id: row.id,
        isPrivate: Boolean(row.isPrivate),
        name: row.name,
        order: row.sortOrder,
        postCount: Number(countRow?.n ?? 0),
        slug: row.slug,
      };
    }),
  );
}

export async function insertSpace(
  store: TenantStore,
  input: {
    color?: string | null;
    description?: string | null;
    icon?: string | null;
    name: string;
    slug: string;
  },
): Promise<SpaceDetail> {
  const { spaces } = store.tables;
  const id = newId("spc");
  await store.db.insert(spaces).values({
    color: input.color ?? null,
    createdAt: new Date(),
    description: input.description ?? null,
    icon: input.icon ?? null,
    id,
    isPrivate: false,
    name: input.name,
    orgId: store.orgId,
    slug: input.slug,
    sortOrder: 0,
  });
  const listed = await listSpaces(store);
  const created = listed.find((space) => space.id === id);
  if (!created) {
    throw new Error("insert space failed");
  }
  return created;
}

export async function findSpaceBySlug(store: TenantStore, slug: string): Promise<SpaceRow | null> {
  const { spaces } = store.tables;
  const rows = await store.db
    .select()
    .from(spaces)
    .where(and(eq(spaces.orgId, store.orgId), eq(spaces.slug, slug)))
    .limit(1);
  return first(rows) ?? null;
}

export async function getSpace(store: TenantStore, id: string): Promise<SpaceRow | null> {
  return await spaceById(store, id);
}

export async function listPosts(
  store: TenantStore,
  options: { spaceSlug?: string | null; viewerId?: string } = {},
): Promise<PostDetail[]> {
  const { posts } = store.tables;
  let spaceId: string | undefined;
  if (options.spaceSlug) {
    const space = await findSpaceBySlug(store, options.spaceSlug);
    if (!space) {
      return [];
    }
    spaceId = space.id;
  }
  const rows = await store.db
    .select()
    .from(posts)
    .where(
      spaceId
        ? and(eq(posts.orgId, store.orgId), eq(posts.spaceId, spaceId))
        : eq(posts.orgId, store.orgId),
    )
    .orderBy(desc(posts.isPinned), desc(posts.createdAt));
  return Promise.all(rows.map((row) => toPostDetail(store, row, options.viewerId)));
}

export async function getPost(
  store: TenantStore,
  id: string,
  viewerId?: string,
): Promise<Result<{ post: PostDetail }>> {
  const { posts } = store.tables;
  const rows = await store.db
    .select()
    .from(posts)
    .where(and(eq(posts.orgId, store.orgId), eq(posts.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Post not found");
  }
  return ok({ post: await toPostDetail(store, row, viewerId) });
}

export async function insertPost(
  store: TenantStore,
  input: {
    authorUserId: string;
    body: string;
    mediaType?: string | null;
    mediaUrl?: string | null;
    spaceId: string;
    title?: string | null;
  },
): Promise<PostDetail> {
  const { posts } = store.tables;
  const now = new Date();
  const id = newId("post");
  await store.db.insert(posts).values({
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: now,
    id,
    isPinned: false,
    mediaType: input.mediaType ?? null,
    mediaUrl: input.mediaUrl ?? null,
    orgId: store.orgId,
    spaceId: input.spaceId,
    title: input.title ?? null,
    updatedAt: now,
  });
  const created = await getPost(store, id, input.authorUserId);
  if (!created.ok) {
    throw new Error("insert post failed");
  }
  return created.post;
}

export async function updatePost(
  store: TenantStore,
  id: string,
  patch: {
    body?: string;
    isPinned?: boolean;
    mediaType?: string | null;
    mediaUrl?: string | null;
    spaceId?: string | null;
    title?: string | null;
  },
  viewerId?: string,
): Promise<Result<{ post: PostDetail }>> {
  const existing = await getPost(store, id, viewerId);
  if (!existing.ok) {
    return existing;
  }
  const { posts } = store.tables;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      set[key] = value;
    }
  }
  await store.db
    .update(posts)
    .set(set)
    .where(and(eq(posts.orgId, store.orgId), eq(posts.id, id)));
  return getPost(store, id, viewerId);
}

export async function deletePost(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getPost(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { posts } = store.tables;
  await store.db.delete(posts).where(and(eq(posts.orgId, store.orgId), eq(posts.id, id)));
  return ok({ success: true });
}

export async function listComments(store: TenantStore, postId: string): Promise<CommentNode[]> {
  const { comments } = store.tables;
  const rows = await store.db
    .select()
    .from(comments)
    .where(and(eq(comments.orgId, store.orgId), eq(comments.postId, postId)))
    .orderBy(asc(comments.createdAt));
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const row of rows) {
    map.set(row.id, {
      authorId: row.authorUserId,
      content: row.body,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      parentId: row.parentId ?? null,
      replies: [],
    });
  }
  for (const row of rows) {
    const node = map.get(row.id);
    if (!node) {
      continue;
    }
    const parent = row.parentId ? map.get(row.parentId) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function getComment(store: TenantStore, id: string): Promise<CommentRow | null> {
  const { comments } = store.tables;
  const rows = await store.db
    .select()
    .from(comments)
    .where(and(eq(comments.orgId, store.orgId), eq(comments.id, id)))
    .limit(1);
  return first(rows) ?? null;
}

export async function insertComment(
  store: TenantStore,
  input: { authorUserId: string; body: string; parentId?: string | null; postId: string },
): Promise<CommentNode> {
  const { comments } = store.tables;
  const now = new Date();
  const id = newId("cmt");
  await store.db.insert(comments).values({
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: now,
    id,
    orgId: store.orgId,
    parentId: input.parentId ?? null,
    postId: input.postId,
    updatedAt: now,
  });
  return {
    authorId: input.authorUserId,
    content: input.body,
    createdAt: now.toISOString(),
    id,
    parentId: input.parentId ?? null,
    replies: [],
  };
}

export async function updateComment(
  store: TenantStore,
  id: string,
  body: string,
): Promise<Result<{ comment: CommentNode }>> {
  const existing = await getComment(store, id);
  if (!existing) {
    return err("not_found", 404, "Comment not found");
  }
  const { comments } = store.tables;
  await store.db
    .update(comments)
    .set({ body, updatedAt: new Date() })
    .where(and(eq(comments.orgId, store.orgId), eq(comments.id, id)));
  return ok({
    comment: {
      authorId: existing.authorUserId,
      content: body,
      createdAt: existing.createdAt.toISOString(),
      id,
      parentId: existing.parentId ?? null,
      replies: [],
    },
  });
}

export async function deleteComment(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getComment(store, id);
  if (!existing) {
    return err("not_found", 404, "Comment not found");
  }
  const { comments } = store.tables;
  await store.db.delete(comments).where(and(eq(comments.orgId, store.orgId), eq(comments.id, id)));
  return ok({ success: true });
}

export async function toggleReaction(
  store: TenantStore,
  table: "reactions" | "commentReactions",
  ownerKey: "postId" | "commentId",
  ownerId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  const target = store.tables[table];
  const ownerColumn =
    table === "reactions" ? store.tables.reactions.postId : store.tables.commentReactions.commentId;
  const rows = await store.db
    .select()
    .from(target)
    .where(
      and(
        eq(target.orgId, store.orgId),
        eq(ownerColumn, ownerId),
        eq(target.userId, userId),
        eq(target.emoji, emoji),
      ),
    )
    .limit(1);
  const existing = first(rows);
  if (existing) {
    await store.db
      .delete(target)
      .where(and(eq(target.orgId, store.orgId), eq(target.id, existing.id)));
    return false;
  }
  await store.db.insert(target).values({
    createdAt: new Date(),
    emoji,
    id: newId("rxn"),
    orgId: store.orgId,
    userId,
    [ownerKey]: ownerId,
  });
  return true;
}

export async function listReactions(
  store: TenantStore,
  table: "reactions" | "commentReactions",
  _ownerKey: "postId" | "commentId",
  ownerId: string,
  viewerId: string | null,
): Promise<ReactionSummary[]> {
  const target = store.tables[table];
  const ownerColumn =
    table === "reactions" ? store.tables.reactions.postId : store.tables.commentReactions.commentId;
  const rows = await store.db
    .select()
    .from(target)
    .where(and(eq(target.orgId, store.orgId), eq(ownerColumn, ownerId)));
  const byEmoji = new Map<string, { count: number; reacted: boolean }>();
  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? { count: 0, reacted: false };
    entry.count += 1;
    if (viewerId && row.userId === viewerId) {
      entry.reacted = true;
    }
    byEmoji.set(row.emoji, entry);
  }
  return [...byEmoji.entries()].map(([emoji, value]) => ({
    count: value.count,
    emoji,
    reacted: value.reacted,
  }));
}

export async function toggleLike(
  store: TenantStore,
  postId: string,
  userId: string,
): Promise<boolean> {
  const { likes } = store.tables;
  const rows = await store.db
    .select()
    .from(likes)
    .where(and(eq(likes.orgId, store.orgId), eq(likes.postId, postId), eq(likes.userId, userId)))
    .limit(1);
  const existing = first(rows);
  if (existing) {
    await store.db
      .delete(likes)
      .where(and(eq(likes.orgId, store.orgId), eq(likes.id, existing.id)));
    return false;
  }
  await store.db.insert(likes).values({
    createdAt: new Date(),
    id: newId("like"),
    orgId: store.orgId,
    postId,
    userId,
  });
  return true;
}

export async function toggleBookmark(
  store: TenantStore,
  postId: string,
  userId: string,
): Promise<boolean> {
  const { bookmarks } = store.tables;
  const rows = await store.db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.orgId, store.orgId),
        eq(bookmarks.postId, postId),
        eq(bookmarks.userId, userId),
      ),
    )
    .limit(1);
  const existing = first(rows);
  if (existing) {
    await store.db
      .delete(bookmarks)
      .where(and(eq(bookmarks.orgId, store.orgId), eq(bookmarks.id, existing.id)));
    return false;
  }
  await store.db.insert(bookmarks).values({
    createdAt: new Date(),
    id: newId("bmk"),
    orgId: store.orgId,
    postId,
    userId,
  });
  return true;
}

export async function unreadCountForSpace(
  store: TenantStore,
  spaceId: string,
  userId: string,
  since: Date,
): Promise<number> {
  const { posts } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(posts)
    .where(
      and(
        eq(posts.orgId, store.orgId),
        eq(posts.spaceId, spaceId),
        ne(posts.authorUserId, userId),
        gt(posts.createdAt, since),
      ),
    );
  const [row] = rows;
  return Number(row?.n ?? 0);
}

export async function getSpaceViewedAt(
  store: TenantStore,
  spaceId: string,
  userId: string,
): Promise<Date | null> {
  const { spaceViews } = store.tables;
  const rows = await store.db
    .select()
    .from(spaceViews)
    .where(
      and(
        eq(spaceViews.orgId, store.orgId),
        eq(spaceViews.spaceId, spaceId),
        eq(spaceViews.userId, userId),
      ),
    )
    .limit(1);
  return first(rows)?.viewedAt ?? null;
}

export async function upsertSpaceView(
  store: TenantStore,
  spaceId: string,
  userId: string,
  viewedAt: Date,
): Promise<void> {
  const { spaceViews } = store.tables;
  const existing = await getSpaceViewedAt(store, spaceId, userId);
  if (existing) {
    await store.db
      .update(spaceViews)
      .set({ viewedAt })
      .where(
        and(
          eq(spaceViews.orgId, store.orgId),
          eq(spaceViews.spaceId, spaceId),
          eq(spaceViews.userId, userId),
        ),
      );
    return;
  }
  await store.db.insert(spaceViews).values({
    id: newId("svw"),
    orgId: store.orgId,
    spaceId,
    userId,
    viewedAt,
  });
}
