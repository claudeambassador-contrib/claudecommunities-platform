/**
 * Comments service — owns the create/update/delete/list-tree pipeline for
 * post comments, plus reply notification dispatch.
 *
 * Reactions live in services/reactions.ts (delegate, don't wrap).
 *
 * Callers: /api/posts/[id]/comments/route.ts (GET + POST) and the MCP
 * tools addComment / updateComment / deleteComment.
 */

import { publishNotification } from "@/lib/notify";
import { getPrisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/tenant-config";
import type { ActorLike } from "./_auth";
import { ensureOwner } from "./_auth";
import { ServiceError } from "./_errors";
import { generateId } from "./_ids";
import { createReplyNotification } from "./notifications";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface CommentNode {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: { id: string; name: string | null; image: string | null; role: string | null };
  replies: CommentNode[];
}

export interface CreateCommentInput {
  postId: string;
  content: string;
  parentId?: string | null;
}

export interface UpdateCommentInput {
  content: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Read
// ──────────────────────────────────────────────────────────────────────────

export async function listForPost(postId: string): Promise<CommentNode[]> {
  // getPrisma() scopes Comment to the current tenant (the old raw `WHERE
  // c.postId = ?` had no tenant filter); `author` is the global User (scalars
  // only — no scoped relation traversed, so no extra filter needed).
  const db = await getPrisma();
  const comments = await db.comment.findMany({
    where: { postId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      parentId: true,
      author: { select: { name: true, image: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of comments) {
    map.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId,
      author: { id: c.authorId, name: c.author.name, image: c.author.image, role: c.author.role },
      replies: [],
    });
  }
  for (const c of comments) {
    const node = map.get(c.id);
    if (!node) continue;
    const parent = c.parentId ? map.get(c.parentId) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ──────────────────────────────────────────────────────────────────────────
// Writes
// ──────────────────────────────────────────────────────────────────────────

export interface CreatedComment {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: { id: string; name: string | null; image: string | null; role: string | null };
  replies: [];
}

export async function createComment(
  actor: ActorLike,
  input: CreateCommentInput,
): Promise<CreatedComment> {
  if (!input.content?.trim()) {
    throw new ServiceError("bad_request", "Content is required");
  }

  const db = await getPrisma();
  const post = await db.post.findUnique({
    where: { id: input.postId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    throw new ServiceError("not_found", "Post not found");
  }

  if (input.parentId) {
    const parent = await db.comment.findUnique({
      where: { id: input.parentId },
      select: { id: true, postId: true },
    });
    if (!parent || parent.postId !== input.postId) {
      throw new ServiceError("not_found", "Parent comment not found on this post");
    }
  }

  const id = generateId("comment");
  const created = await db.comment.create({
    data: {
      id,
      content: input.content.trim(),
      authorId: actor.id,
      postId: input.postId,
      parentId: input.parentId ?? null,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      author: { select: { id: true, name: true, image: true, role: true } },
    },
  });

  // Notify the post author when someone else comments.
  if (post.authorId !== actor.id) {
    const commenterName =
      (
        await db.user.findUnique({
          where: { id: actor.id },
          select: { name: true },
        })
      )?.name || "Someone";
    createReplyNotification(
      post.authorId,
      commenterName,
      input.postId,
      input.content.substring(0, 100),
    ).catch(console.error);
  }

  // Fire-and-forget Slack notification via the shared notifications queue.
  const baseUrl = (await getTenantConfig()).appUrl;
  publishNotification({
    type: "community.comment.created",
    data: {
      id: created.id,
      postId: input.postId,
      authorId: actor.id,
      authorName: created.author.name,
      excerpt: created.content.slice(0, 200),
      manageUrl: `${baseUrl}/admin/posts`,
    },
  });

  return {
    id: created.id,
    content: created.content,
    createdAt: created.createdAt.toISOString(),
    parentId: created.parentId,
    author: created.author,
    replies: [],
  };
}

export async function updateComment(
  actor: ActorLike,
  id: string,
  input: UpdateCommentInput,
): Promise<{ id: string }> {
  if (!input.content?.trim()) {
    throw new ServiceError("bad_request", "Content is required");
  }
  const db = await getPrisma();
  const existing = await db.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) {
    throw new ServiceError("not_found", "Comment not found");
  }
  ensureOwner(actor, existing.authorId);

  await db.comment.update({
    where: { id },
    data: { content: input.content.trim() },
  });
  return { id };
}

export async function deleteComment(actor: ActorLike, id: string): Promise<void> {
  const db = await getPrisma();
  const existing = await db.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) {
    throw new ServiceError("not_found", "Comment not found");
  }
  ensureOwner(actor, existing.authorId);

  // CommentReaction + replies cascade via schema (parent has onDelete: Cascade
  // for replies, and CommentReaction.commentId is Cascade).
  await db.comment.delete({ where: { id } });
}
