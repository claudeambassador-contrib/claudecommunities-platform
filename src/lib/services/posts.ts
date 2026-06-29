/**
 * Posts service — owns the create/update/delete/list/get pipeline for posts,
 * plus media mirroring, mention dispatch, activity logging, and points.
 *
 * API routes (/api/posts, /api/posts/[id], /api/admin/posts/[id],
 * /api/bookmarks) and MCP tools (getFeed/getPost/createPost/updatePost/
 * deletePost) all go through this module — no direct Prisma / storage /
 * notifications imports allowed in those callers.
 */

import { publishNotification } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { CACHE_TAGS, revalidateTagSafe } from "@/lib/revalidate";
import { IMAGE_MIME_TYPES, isStorageUrl, putFromUrl } from "@/lib/storage";
import { getTenantConfig } from "@/lib/tenant-config";
import type { ActorLike } from "./_auth";
import { ensureOwner, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";
import { generateId } from "./_ids";
import { awardPoints, recordActivity } from "./activity";
import { createMentionNotification } from "./notifications";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface ListPostRow {
  id: string;
  title: string | null;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  isPinned: number;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  spaceId: string;
  authorName: string | null;
  authorImage: string | null;
  authorTagline: string | null;
  authorRole: string | null;
  spaceName: string;
  spaceSlug: string;
  spaceColor: string | null;
  likeCount: number;
  commentCount: number;
  pollId: string | null;
}

interface CommentPreviewRow {
  id: string;
  content: string;
  createdAt: string;
  postId: string;
  authorId: string;
  authorName: string | null;
  authorImage: string | null;
  authorRole: string | null;
}

interface AttachmentRow {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  postId: string;
}

type Badge = { id: string; name: string; icon: string | null; color: string | null };

export interface FormattedPost {
  id: string;
  title: string | null;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    tagline: string | null;
    role: string | null;
    badges: Badge[];
  };
  space: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  _count: { likes: number; comments: number };
  isLiked: boolean;
  pollId: string | null;
  attachments: Array<{ id: string; name: string; url: string; type: string; size: number }>;
  commentsPreview: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string | null; image: string | null; role: string | null };
  }>;
}

export interface ListFeedOptions {
  spaceSlug?: string | null;
  limit?: number;
  offset?: number;
  actor?: ActorLike | null;
}

export interface CreatePostInput {
  content: string;
  spaceId: string;
  title?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mentionedUserIds?: string[];
  poll?: { question: string; options: string[]; endsAt?: string | null } | null;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
}

export interface UpdatePostInput {
  content?: string | null;
  title?: string | null;
  /** Only honoured for admin actors (mass-assignment defence in web route). */
  spaceId?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  /** When true, clears mediaUrl/mediaType. */
  removeImage?: boolean;
  /** Optional: mirror a remote image URL into R2 before saving. */
  imageUrl?: string | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns a `(mediaUrl, mediaType)` pair for a post write. Trusts URLs that
 * already point at our R2 (uploaded via /api/upload) and mirrors any other
 * remote URL through `putFromUrl` so MCP gains the same MIME validation the
 * web upload pipeline enforces.
 */
async function mirrorPostMedia(url: string): Promise<{ mediaUrl: string; mediaType: string }> {
  if (isStorageUrl(url)) {
    return { mediaUrl: url, mediaType: "image" };
  }
  const result = await putFromUrl(url, {
    folder: "community/posts",
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  return { mediaUrl: result.url, mediaType: "image" };
}

/**
 * Current shape: callers pass an explicit `mentionedUserIds` array. The
 * intent is to centralise mention bookkeeping here so when we add server-
 * side `@username` parsing it lands in one place.
 */
function extractMentions(input: { mentionedUserIds?: string[] }): string[] {
  return Array.from(new Set((input.mentionedUserIds ?? []).filter(Boolean)));
}

// Shape returned by the scoped post reads (author/space/_count/poll included).
type PostWithRelations = {
  id: string;
  title: string | null;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  spaceId: string;
  author: {
    name: string | null;
    image: string | null;
    tagline: string | null;
    role: string | null;
  };
  space: { name: string; slug: string; color: string | null };
  _count: { likes: number; comments: number };
  poll: { id: string } | null;
};

/** The Prisma include used by every post read so `rowFromPrisma` can flatten it. */
const POST_INCLUDE = {
  author: { select: { name: true, image: true, tagline: true, role: true } },
  space: { select: { name: true, slug: true, color: true } },
  _count: { select: { likes: true, comments: true } },
  poll: { select: { id: true } },
} as const;

/**
 * Flatten a scoped Prisma post into the `ListPostRow` shape `formatPost` expects,
 * so the wire output is byte-identical to the old raw-SQL path. (The reads moved
 * to getPrisma() to inherit the tenant chokepoint — the old `@/lib/db` queries
 * had no tenantId filter and returned every tenant's posts.)
 */
function rowFromPrisma(p: PostWithRelations): ListPostRow {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    mediaUrl: p.mediaUrl,
    mediaType: p.mediaType,
    isPinned: p.isPinned ? 1 : 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    authorId: p.authorId,
    spaceId: p.spaceId,
    authorName: p.author.name,
    authorImage: p.author.image,
    authorTagline: p.author.tagline,
    authorRole: p.author.role,
    spaceName: p.space.name,
    spaceSlug: p.space.slug,
    spaceColor: p.space.color,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    pollId: p.poll?.id ?? null,
  };
}

/**
 * Author badges keyed by userId, scoped to the current tenant. `UserBadge` is
 * tenant-scoped, so getPrisma() injects tenantId — a globally-shared author's
 * badges from OTHER tenants never appear (the old raw `WHERE ub.userId IN (...)`
 * had no tenant filter and leaked them). Chunked to stay under D1's param cap.
 */
async function badgesByAuthor(
  db: Awaited<ReturnType<typeof getPrisma>>,
  authorIds: string[],
): Promise<Record<string, Badge[]>> {
  const out: Record<string, Badge[]> = {};
  const CHUNK = 90;
  for (let i = 0; i < authorIds.length; i += CHUNK) {
    const slice = authorIds.slice(i, i + CHUNK);
    const rows = await db.userBadge.findMany({
      where: { userId: { in: slice } },
      select: {
        userId: true,
        badge: { select: { id: true, name: true, icon: true, color: true } },
      },
    });
    for (const r of rows) {
      out[r.userId] ??= [];
      out[r.userId].push(r.badge);
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Read paths (raw SQL preserved — complex aggregates + IN-clause batches)
// ──────────────────────────────────────────────────────────────────────────

export async function listFeed(opts: ListFeedOptions = {}): Promise<FormattedPost[]> {
  const limit = Math.min(opts.limit ?? 20, 90);
  const offset = opts.offset ?? 0;
  const actor = opts.actor ?? null;
  const db = await getPrisma();

  // Post is tenant-scoped — getPrisma() injects tenantId, so the feed is this
  // tenant's posts only (the old raw query had no tenant filter).
  const posts = await db.post.findMany({
    where: opts.spaceSlug ? { space: { is: { slug: opts.spaceSlug } } } : undefined,
    include: POST_INCLUDE,
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    skip: offset,
  });

  const postIds = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.authorId)));
  const attachmentsByPost: Record<string, AttachmentRow[]> = {};
  const commentsByPost: Record<string, CommentPreviewRow[]> = {};
  const likedPostIds = new Set<string>();

  // All four batches are scoped (tenantId auto-injected); the postId/authorId
  // `in` lists are already this-tenant rows, so the children stay in-tenant.
  const [attachments, comments, likes, badgesByUser] = await Promise.all([
    postIds.length
      ? db.attachment.findMany({
          where: { postId: { in: postIds } },
          select: { id: true, name: true, url: true, type: true, size: true, postId: true },
        })
      : Promise.resolve([]),
    postIds.length
      ? db.comment.findMany({
          where: { postId: { in: postIds }, parentId: null },
          select: {
            id: true,
            content: true,
            createdAt: true,
            postId: true,
            authorId: true,
            author: { select: { name: true, image: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    actor && postIds.length
      ? db.like.findMany({
          where: { userId: actor.id, postId: { in: postIds } },
          select: { postId: true },
        })
      : Promise.resolve([]),
    badgesByAuthor(db, authorIds),
  ]);

  for (const att of attachments) {
    attachmentsByPost[att.postId] ??= [];
    attachmentsByPost[att.postId].push(att);
  }
  for (const c of comments) {
    commentsByPost[c.postId] ??= [];
    const arr = commentsByPost[c.postId];
    if (arr.length < 2) {
      arr.push({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        postId: c.postId,
        authorId: c.authorId,
        authorName: c.author.name,
        authorImage: c.author.image,
        authorRole: c.author.role,
      });
    }
  }
  for (const l of likes) likedPostIds.add(l.postId);

  return posts.map((post) =>
    formatPost(rowFromPrisma(post), {
      badges: badgesByUser[post.authorId] ?? [],
      isLiked: likedPostIds.has(post.id),
      attachments: attachmentsByPost[post.id] ?? [],
      commentsPreview: commentsByPost[post.id] ?? [],
    }),
  );
}

export async function getPost(id: string, actor?: ActorLike | null): Promise<FormattedPost> {
  const db = await getPrisma();
  // findUnique by id → the chokepoint adds tenantId, so a foreign-tenant post
  // resolves to null (not_found) rather than leaking.
  const post = await db.post.findUnique({ where: { id }, include: POST_INCLUDE });

  if (!post) {
    throw new ServiceError("not_found", "Post not found");
  }

  let isLiked = false;
  if (actor) {
    const like = await db.like.findFirst({
      where: { userId: actor.id, postId: post.id },
      select: { id: true },
    });
    isLiked = !!like;
  }

  return formatPost(rowFromPrisma(post), { isLiked });
}

/**
 * Formats a row from the post list/detail queries into the wire shape that
 * the web client expects. Pass extras (badges, isLiked, attachments,
 * commentsPreview) — defaults fill in empty arrays so single-post callers
 * don't need to pass them.
 */
export function formatPost(
  row: ListPostRow,
  extras: {
    badges?: Badge[];
    isLiked?: boolean;
    attachments?: AttachmentRow[];
    commentsPreview?: CommentPreviewRow[];
  } = {},
): FormattedPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mediaUrl: row.mediaUrl,
    mediaType: row.mediaType,
    isPinned: Boolean(row.isPinned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      id: row.authorId,
      name: row.authorName,
      image: row.authorImage,
      tagline: row.authorTagline,
      role: row.authorRole,
      badges: extras.badges ?? [],
    },
    space: {
      id: row.spaceId,
      name: row.spaceName,
      slug: row.spaceSlug,
      color: row.spaceColor,
    },
    _count: { likes: row.likeCount, comments: row.commentCount },
    isLiked: extras.isLiked ?? false,
    pollId: row.pollId,
    attachments: (extras.attachments ?? []).map((att) => ({
      id: att.id,
      name: att.name,
      url: att.url,
      type: att.type,
      size: att.size,
    })),
    commentsPreview: (extras.commentsPreview ?? []).map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: { id: c.authorId, name: c.authorName, image: c.authorImage, role: c.authorRole },
    })),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Writes (Prisma)
// ──────────────────────────────────────────────────────────────────────────

export interface CreatePostResult {
  id: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential validation + attachment/space-resolution branches; splitting would obscure the single create flow
export async function createPost(
  actor: ActorLike,
  input: CreatePostInput,
): Promise<CreatePostResult> {
  if (!input.content?.trim()) {
    throw new ServiceError("bad_request", "Content is required");
  }
  if (!input.spaceId) {
    throw new ServiceError("bad_request", "Space is required");
  }

  const id = generateId("post");
  const db = await getPrisma();

  const post = await db.post.create({
    data: {
      id,
      title: input.title || null,
      content: input.content,
      mediaUrl: input.mediaUrl ?? null,
      mediaType: input.mediaType ?? null,
      authorId: actor.id,
      spaceId: input.spaceId,
      isPinned: false,
    },
    select: { id: true, author: { select: { name: true } } },
  });

  // Mentions
  const mentionIds = extractMentions(input);
  if (mentionIds.length > 0) {
    const authorName =
      (
        await db.user.findUnique({
          where: { id: actor.id },
          select: { name: true },
        })
      )?.name || "Someone";
    for (const mentionedUserId of mentionIds) {
      if (mentionedUserId === actor.id) continue;
      try {
        await db.mention.create({
          data: { userId: mentionedUserId, postId: post.id },
        });
        createMentionNotification(
          mentionedUserId,
          authorName,
          post.id,
          input.content.substring(0, 100),
        ).catch(console.error);
      } catch {
        // Duplicate mention — ignore (unique constraint userId+postId).
      }
    }
  }

  // Poll
  if (input.poll?.question && input.poll.options && input.poll.options.length >= 2) {
    const endsAt = input.poll.endsAt ? new Date(input.poll.endsAt) : null;
    await db.poll.create({
      data: {
        question: input.poll.question,
        endsAt,
        postId: post.id,
        options: {
          create: input.poll.options.map((text, index) => ({ text, order: index })),
        },
      },
    });
  }

  // Attachments
  if (input.attachments?.length) {
    for (const att of input.attachments) {
      if (!att.name || !att.url || !att.type) continue;
      try {
        await db.attachment.create({
          data: {
            name: att.name,
            url: att.url,
            type: att.type,
            size: att.size ?? 0,
            postId: post.id,
          },
        });
      } catch (e) {
        console.error("Failed to save attachment:", e);
      }
    }
  }

  await recordActivity({
    userId: actor.id,
    type: "post_created",
    data: { postId: post.id, postTitle: input.title || input.content.substring(0, 50) },
  });
  await awardPoints(actor.id, 10);

  // Refresh the cross-request community widgets (post count, trending).
  revalidateTagSafe(CACHE_TAGS.posts);

  // Fire-and-forget Slack notification via the shared notifications queue.
  const baseUrl = (await getTenantConfig()).appUrl;
  publishNotification({
    type: "community.post.created",
    data: {
      id: post.id,
      authorId: actor.id,
      authorName: post.author.name,
      title: input.title || null,
      excerpt: input.content.slice(0, 200),
      manageUrl: `${baseUrl}/admin/posts`,
    },
  });

  return { id: post.id };
}

export async function updatePost(
  actor: ActorLike,
  id: string,
  input: UpdatePostInput,
): Promise<{ id: string; mediaUrl: string | null; mediaType: string | null }> {
  const db = await getPrisma();
  const existing = await db.post.findUnique({
    where: { id },
    select: {
      authorId: true,
      mediaUrl: true,
      mediaType: true,
      content: true,
      title: true,
      spaceId: true,
    },
  });
  if (!existing) {
    throw new ServiceError("not_found", "Post not found");
  }
  ensureOwner(actor, existing.authorId);

  const newContent = input.content?.trim() || existing.content;
  if (!newContent) {
    throw new ServiceError("bad_request", "Content is required");
  }
  const newTitle = input.title !== undefined ? input.title || null : existing.title;

  // Resolve media: removeImage > imageUrl mirror > explicit mediaUrl/Type > keep
  let mediaUrl: string | null = existing.mediaUrl;
  let mediaType: string | null = existing.mediaType;
  if (input.removeImage) {
    mediaUrl = null;
    mediaType = null;
  } else if (input.imageUrl) {
    const mirrored = await mirrorPostMedia(input.imageUrl);
    mediaUrl = mirrored.mediaUrl;
    mediaType = mirrored.mediaType;
  } else if (input.mediaUrl !== undefined || input.mediaType !== undefined) {
    mediaUrl = input.mediaUrl ?? null;
    mediaType = input.mediaType ?? null;
  }

  // Posts-editors can move a post to any space. Owner edits leave it in place.
  const newSpaceId =
    input.spaceId && hasPermission(actor, "posts.edit") ? input.spaceId : existing.spaceId;

  const updated = await db.post.update({
    where: { id },
    data: {
      title: newTitle,
      content: newContent,
      mediaUrl,
      mediaType,
      spaceId: newSpaceId,
    },
    select: { id: true, mediaUrl: true, mediaType: true },
  });

  return updated;
}

export async function deletePost(actor: ActorLike, id: string): Promise<void> {
  const db = await getPrisma();
  const existing = await db.post.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) {
    throw new ServiceError("not_found", "Post not found");
  }
  ensureOwner(actor, existing.authorId);

  // Cascade deletes Comment/Like/Bookmark/Mention/Reaction/Poll/Attachment via Prisma schema.
  await db.post.delete({ where: { id } });

  revalidateTagSafe(CACHE_TAGS.posts);
}

export async function setPostPin(
  actor: ActorLike,
  id: string,
  pinned: boolean,
): Promise<{ id: string; isPinned: boolean }> {
  ensurePermission(actor, "posts.edit");
  const db = await getPrisma();
  const existing = await db.post.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new ServiceError("not_found", "Post not found");
  }
  await db.post.update({
    where: { id },
    data: { isPinned: pinned },
  });
  return { id, isPinned: pinned };
}

// ──────────────────────────────────────────────────────────────────────────
// Bookmarked feed (used by /api/bookmarks) — keeps its existing shape
// (no commentsPreview/attachments) but adds bookmarkedAt + isBookmarked.
// ──────────────────────────────────────────────────────────────────────────

export interface BookmarkedPost extends FormattedPost {
  bookmarkedAt: string;
  isBookmarked: true;
}

export async function listBookmarkedFeed(actor: ActorLike): Promise<BookmarkedPost[]> {
  const db = await getPrisma();
  // Bookmark is tenant-scoped — getPrisma() injects tenantId, so only this
  // tenant's bookmarks (and their FK-correlated posts) are returned.
  const bookmarks = await db.bookmark.findMany({
    where: { userId: actor.id },
    select: { createdAt: true, post: { include: POST_INCLUDE } },
    orderBy: { createdAt: "desc" },
  });

  const authorIds = Array.from(new Set(bookmarks.map((b) => b.post.authorId)));
  const badgesByUser = await badgesByAuthor(db, authorIds);

  return bookmarks.map((b) => ({
    ...formatPost(rowFromPrisma(b.post), { badges: badgesByUser[b.post.authorId] ?? [] }),
    bookmarkedAt: b.createdAt.toISOString(),
    isBookmarked: true as const,
  }));
}

// Internal export so MCP/createPost can also mirror images from the tool surface.
export { mirrorPostMedia };
