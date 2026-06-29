import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";
import { generateId } from "./_ids";

export async function togglePostLike(
  actor: ActorLike,
  postId: string,
): Promise<{ liked: boolean }> {
  const db = await getPrisma();
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    throw new ServiceError("not_found", "Post not found");
  }

  const existing = await db.like.findFirst({
    where: { userId: actor.id, postId },
    select: { id: true },
  });

  if (existing) {
    await db.like.delete({ where: { id: existing.id } });
    return { liked: false };
  }

  await db.like.create({
    data: { id: generateId("like"), userId: actor.id, postId },
  });
  return { liked: true };
}

export async function isPostLikedByUser(userId: string, postId: string): Promise<boolean> {
  const db = await getPrisma();
  const like = await db.like.findFirst({
    where: { userId, postId },
    select: { id: true },
  });
  return !!like;
}
