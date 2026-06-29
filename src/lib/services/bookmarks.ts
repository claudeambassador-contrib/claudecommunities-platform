import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";
import { generateId } from "./_ids";

export async function togglePostBookmark(
  actor: ActorLike,
  postId: string,
): Promise<{ isBookmarked: boolean }> {
  const db = await getPrisma();
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    throw new ServiceError("not_found", "Post not found");
  }

  const existing = await db.bookmark.findFirst({
    where: { userId: actor.id, postId },
    select: { id: true },
  });

  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
    return { isBookmarked: false };
  }

  await db.bookmark.create({
    data: { id: generateId("bookmark"), userId: actor.id, postId },
  });
  return { isBookmarked: true };
}

export async function isPostBookmarkedByUser(userId: string, postId: string): Promise<boolean> {
  const db = await getPrisma();
  const bookmark = await db.bookmark.findFirst({
    where: { userId, postId },
    select: { id: true },
  });
  return !!bookmark;
}
