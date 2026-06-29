/**
 * Spaces service — list, unread counts per space, view-marking.
 */
import { getPrisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant-context";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";

export async function listSpaces() {
  const db = await getPrisma();
  const spaces = await db.space.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
  return spaces.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    icon: s.icon,
    color: s.color,
    isPrivate: Boolean(s.isPrivate),
    order: s.order,
    _count: { posts: s._count.posts },
  }));
}

/**
 * Per-space unread post counts for the current user. Posts authored by the
 * user are excluded. If the user has never viewed a space, falls back to
 * "posts in the last 7 days" so new users aren't shown a huge backlog.
 */
export async function unreadCounts(actor: ActorLike): Promise<Record<string, number>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const db = await getPrisma();

  const [spaces, views] = await Promise.all([
    db.space.findMany({ select: { id: true } }),
    db.spaceView.findMany({
      where: { userId: actor.id },
      select: { spaceId: true, viewedAt: true },
    }),
  ]);

  const viewMap = new Map(views.map((v) => [v.spaceId, v.viewedAt]));

  const counts: Record<string, number> = {};
  await Promise.all(
    spaces.map(async (s) => {
      const since = viewMap.get(s.id) ?? sevenDaysAgo;
      const count = await db.post.count({
        where: {
          spaceId: s.id,
          authorId: { not: actor.id },
          createdAt: { gt: since },
        },
      });
      if (count > 0) counts[s.id] = count;
    }),
  );
  return counts;
}

export async function markSpaceViewed(actor: ActorLike, spaceId: string) {
  if (!spaceId) throw new ServiceError("bad_request", "spaceId required");
  const db = await getPrisma();
  await db.spaceView.upsert({
    where: {
      tenantId_userId_spaceId: { tenantId: await getTenantId(), userId: actor.id, spaceId },
    },
    create: { userId: actor.id, spaceId, viewedAt: new Date() },
    update: { viewedAt: new Date() },
  });
  return { success: true };
}
