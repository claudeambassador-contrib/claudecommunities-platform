import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";
import { generateId } from "./_ids";

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
}

function assertEmoji(emoji: string | undefined | null): asserts emoji is string {
  if (!emoji || typeof emoji !== "string") {
    throw new ServiceError("bad_request", "Emoji required");
  }
}

export async function togglePostReaction(
  actor: ActorLike,
  postId: string,
  emoji: string,
): Promise<{ reacted: boolean }> {
  assertEmoji(emoji);

  const db = await getPrisma();
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    throw new ServiceError("not_found", "Post not found");
  }

  const existing = await db.reaction.findFirst({
    where: { userId: actor.id, postId, emoji },
    select: { id: true },
  });

  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
    return { reacted: false };
  }

  await db.reaction.create({
    data: { id: generateId("reaction"), userId: actor.id, postId, emoji },
  });
  return { reacted: true };
}

export async function listPostReactions(
  postId: string,
  viewerId: string | null,
): Promise<ReactionSummary[]> {
  const db = await getPrisma();
  const rows = await db.reaction.findMany({
    where: { postId },
    select: { emoji: true, userId: true },
  });

  const byEmoji = new Map<string, { count: number; reacted: boolean }>();
  for (const r of rows) {
    const entry = byEmoji.get(r.emoji) ?? { count: 0, reacted: false };
    entry.count += 1;
    if (viewerId && r.userId === viewerId) entry.reacted = true;
    byEmoji.set(r.emoji, entry);
  }
  return Array.from(byEmoji.entries()).map(([emoji, v]) => ({
    emoji,
    count: v.count,
    reacted: v.reacted,
  }));
}

export async function toggleCommentReaction(
  actor: ActorLike,
  commentId: string,
  emoji: string,
): Promise<{ reacted: boolean }> {
  assertEmoji(emoji);

  const db = await getPrisma();
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true },
  });
  if (!comment) {
    throw new ServiceError("not_found", "Comment not found");
  }

  const existing = await db.commentReaction.findFirst({
    where: { userId: actor.id, commentId, emoji },
    select: { id: true },
  });

  if (existing) {
    await db.commentReaction.delete({ where: { id: existing.id } });
    return { reacted: false };
  }

  await db.commentReaction.create({
    data: { id: generateId("commentReaction"), userId: actor.id, commentId, emoji },
  });
  return { reacted: true };
}

export async function listCommentReactions(
  commentId: string,
  viewerId: string | null,
): Promise<ReactionSummary[]> {
  const db = await getPrisma();
  const rows = await db.commentReaction.findMany({
    where: { commentId },
    select: { emoji: true, userId: true },
  });

  const byEmoji = new Map<string, { count: number; reacted: boolean }>();
  for (const r of rows) {
    const entry = byEmoji.get(r.emoji) ?? { count: 0, reacted: false };
    entry.count += 1;
    if (viewerId && r.userId === viewerId) entry.reacted = true;
    byEmoji.set(r.emoji, entry);
  }
  return Array.from(byEmoji.entries()).map(([emoji, v]) => ({
    emoji,
    count: v.count,
    reacted: v.reacted,
  }));
}
