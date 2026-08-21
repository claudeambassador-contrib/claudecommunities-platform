import { and, desc, eq, sql } from "drizzle-orm";

import type {
  AwardedBadge,
  BadgeDetail,
  BadgeHolder,
  BadgeSummary,
  BadgeWrite,
} from "@/modules/badges/types";
import { first } from "@/shared/db/rows";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type BadgesTables = Pick<TenantTables, "badges" | "userBadges">;
const tables = (store: TenantStore): BadgesTables => store.tables;

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function toSummary(
  row: {
    createdAt: Date;
    description: string | null;
    id: string;
    imageUrl: string | null;
    name: string;
  },
  userCount: number,
): BadgeSummary {
  return {
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    id: row.id,
    imageUrl: row.imageUrl,
    name: row.name,
    userCount,
  };
}

export async function listBadges(store: TenantStore): Promise<BadgeSummary[]> {
  const { badges, userBadges } = tables(store);
  const rows = await store.db
    .select({
      createdAt: badges.createdAt,
      description: badges.description,
      id: badges.id,
      imageUrl: badges.imageUrl,
      name: badges.name,
      userCount: sql<number>`count(${userBadges.id})`,
    })
    .from(badges)
    .leftJoin(userBadges, and(eq(userBadges.badgeId, badges.id), eq(userBadges.orgId, store.orgId)))
    .where(eq(badges.orgId, store.orgId))
    .groupBy(badges.id)
    .orderBy(desc(badges.createdAt));
  return rows.map((row) => toSummary(row, Number(row.userCount)));
}

export async function findBadge(store: TenantStore, id: string): Promise<BadgeDetail | null> {
  const { badges, userBadges } = tables(store);
  const row = first(
    await store.db
      .select()
      .from(badges)
      .where(and(eq(badges.orgId, store.orgId), eq(badges.id, id)))
      .limit(1),
  );
  if (!row) {
    return null;
  }
  const holders = await store.db
    .select({ awardedAt: userBadges.awardedAt, userId: userBadges.userId })
    .from(userBadges)
    .where(and(eq(userBadges.orgId, store.orgId), eq(userBadges.badgeId, id)))
    .orderBy(desc(userBadges.awardedAt));
  const users: BadgeHolder[] = holders.map((holder) => ({
    awardedAt: holder.awardedAt.toISOString(),
    userId: holder.userId,
  }));
  return { ...toSummary(row, users.length), users };
}

export async function insertBadge(
  store: TenantStore,
  write: BadgeWrite,
): Promise<Result<{ badge: BadgeSummary }>> {
  const { badges } = tables(store);
  const now = new Date();
  const id = newId("bdg");
  try {
    await store.db.insert(badges).values({
      createdAt: now,
      description: write.description,
      id,
      imageUrl: write.imageUrl,
      name: write.name,
      orgId: store.orgId,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A badge with this name already exists");
    }
    throw error;
  }
  return ok({
    badge: {
      createdAt: now.toISOString(),
      description: write.description,
      id,
      imageUrl: write.imageUrl,
      name: write.name,
      userCount: 0,
    },
  });
}

export async function updateBadge(
  store: TenantStore,
  id: string,
  write: BadgeWrite,
): Promise<Result<{ success: true }>> {
  const existing = await findBadge(store, id);
  if (!existing) {
    return err("not_found", 404, "Badge not found");
  }
  const { badges } = tables(store);
  try {
    await store.db
      .update(badges)
      .set({
        description: write.description,
        imageUrl: write.imageUrl,
        name: write.name,
      })
      .where(and(eq(badges.orgId, store.orgId), eq(badges.id, id)));
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A badge with this name already exists");
    }
    throw error;
  }
  return ok({ success: true });
}

export async function deleteBadge(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await findBadge(store, id);
  if (!existing) {
    return err("not_found", 404, "Badge not found");
  }
  const { badges } = tables(store);
  await store.db.delete(badges).where(and(eq(badges.orgId, store.orgId), eq(badges.id, id)));
  return ok({ success: true });
}

export async function awardBadge(
  store: TenantStore,
  badgeId: string,
  userId: string,
): Promise<Result<{ award: AwardedBadge }>> {
  const badge = await findBadge(store, badgeId);
  if (!badge) {
    return err("not_found", 404, "Badge not found");
  }
  const { userBadges } = tables(store);
  const now = new Date();
  const id = newId("ubg");
  try {
    await store.db.insert(userBadges).values({
      awardedAt: now,
      badgeId,
      id,
      orgId: store.orgId,
      userId,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "User already has this badge");
    }
    throw error;
  }
  return ok({
    award: { awardedAt: now.toISOString(), badgeId, id, userId },
  });
}

export async function revokeBadge(
  store: TenantStore,
  badgeId: string,
  userId: string,
): Promise<Result<{ success: true }>> {
  const { userBadges } = tables(store);
  const row = first(
    await store.db
      .select()
      .from(userBadges)
      .where(
        and(
          eq(userBadges.orgId, store.orgId),
          eq(userBadges.badgeId, badgeId),
          eq(userBadges.userId, userId),
        ),
      )
      .limit(1),
  );
  if (!row) {
    return err("not_found", 404, "User does not have this badge");
  }
  await store.db
    .delete(userBadges)
    .where(and(eq(userBadges.orgId, store.orgId), eq(userBadges.id, row.id)));
  return ok({ success: true });
}
