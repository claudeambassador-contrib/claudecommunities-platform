/**
 * Badges service — admin-only writes, public reads.
 */
import { getPrisma } from "@/lib/prisma";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

export interface BadgeInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export async function listBadges() {
  const db = await getPrisma();
  const rows = await db.badge.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { userBadges: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    color: b.color,
    createdAt: b.createdAt.toISOString(),
    userCount: b._count.userBadges,
  }));
}

export async function getBadge(badgeId: string) {
  const db = await getPrisma();
  const badge = await db.badge.findUnique({
    where: { id: badgeId },
    include: {
      userBadges: {
        orderBy: { awardedAt: "desc" },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });
  if (!badge) throw new ServiceError("not_found", "Badge not found");
  return {
    id: badge.id,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    color: badge.color,
    createdAt: badge.createdAt.toISOString(),
    users: badge.userBadges.map((ub) => ({
      id: ub.user.id,
      name: ub.user.name,
      image: ub.user.image,
      awardedAt: ub.awardedAt.toISOString(),
    })),
  };
}

function validateInput(input: BadgeInput) {
  const name = input.name?.trim();
  if (!name) throw new ServiceError("bad_request", "Badge name is required");
  return {
    name,
    description: input.description?.trim() || null,
    icon: input.icon || null,
    color: input.color || null,
  };
}

export async function createBadge(actor: ActorLike, input: BadgeInput) {
  const db = await getPrisma();
  ensurePermission(actor, "badges.edit");
  const data = validateInput(input);
  const existing = await db.badge.findFirst({
    where: { name: data.name },
    select: { id: true },
  });
  if (existing) throw new ServiceError("bad_request", "A badge with this name already exists");

  const badge = await db.badge.create({ data });
  return {
    id: badge.id,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    color: badge.color,
    createdAt: badge.createdAt.toISOString(),
    userCount: 0,
  };
}

export async function updateBadge(actor: ActorLike, badgeId: string, input: BadgeInput) {
  const db = await getPrisma();
  ensurePermission(actor, "badges.edit");
  const data = validateInput(input);

  const badge = await db.badge.findUnique({ where: { id: badgeId }, select: { id: true } });
  if (!badge) throw new ServiceError("not_found", "Badge not found");

  const dup = await db.badge.findFirst({
    where: { name: data.name, NOT: { id: badgeId } },
    select: { id: true },
  });
  if (dup) throw new ServiceError("bad_request", "A badge with this name already exists");

  await db.badge.update({ where: { id: badgeId }, data });
  return { success: true };
}

export async function deleteBadge(actor: ActorLike, badgeId: string) {
  const db = await getPrisma();
  ensurePermission(actor, "badges.delete");
  const badge = await db.badge.findUnique({ where: { id: badgeId }, select: { id: true } });
  if (!badge) throw new ServiceError("not_found", "Badge not found");
  await db.badge.delete({ where: { id: badgeId } });
  return { success: true };
}

export async function awardBadge(actor: ActorLike, badgeId: string, userId: string) {
  const db = await getPrisma();
  ensurePermission(actor, "badges.edit");
  if (!userId) throw new ServiceError("bad_request", "userId is required");

  const [badge, user] = await Promise.all([
    db.badge.findUnique({ where: { id: badgeId }, select: { id: true } }),
    db.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ]);
  if (!badge) throw new ServiceError("not_found", "Badge not found");
  if (!user) throw new ServiceError("not_found", "User not found");

  const existing = await db.userBadge.findFirst({
    where: { userId, badgeId },
    select: { id: true },
  });
  if (existing) throw new ServiceError("conflict", "User already has this badge");

  const ub = await db.userBadge.create({ data: { userId, badgeId } });
  return { id: ub.id, userId, badgeId, awardedAt: ub.awardedAt.toISOString() };
}

export async function revokeBadge(actor: ActorLike, badgeId: string, userId: string) {
  const db = await getPrisma();
  ensurePermission(actor, "badges.edit");
  if (!userId) throw new ServiceError("bad_request", "userId is required");
  const existing = await db.userBadge.findFirst({
    where: { userId, badgeId },
    select: { id: true },
  });
  if (!existing) throw new ServiceError("not_found", "User does not have this badge");
  await db.userBadge.delete({ where: { id: existing.id } });
  return { success: true };
}
