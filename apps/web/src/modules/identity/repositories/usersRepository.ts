import { and, eq } from "drizzle-orm";
import { users, userMemberships, type UserRow } from "@/modules/identity/schema.registry";
import type { RegistryDb } from "@/shared/db/client";

export async function findByClerkId(
  db: RegistryDb,
  clerkUserId: string,
): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertFromClerk(
  db: RegistryDb,
  input: {
    id: string;
    clerkUserId: string;
    email: string;
    displayName: string | null;
    imageUrl: string | null;
    now: Date;
  },
): Promise<UserRow> {
  const existing = await findByClerkId(db, input.clerkUserId);
  if (existing) {
    await db
      .update(users)
      .set({
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
        updatedAt: input.now,
      })
      .where(eq(users.id, existing.id));
    return (await findByClerkId(db, input.clerkUserId))!;
  }

  await db.insert(users).values({
    id: input.id,
    clerkUserId: input.clerkUserId,
    email: input.email,
    displayName: input.displayName,
    imageUrl: input.imageUrl,
    isBanned: false,
    isSuperAdmin: false,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return (await findByClerkId(db, input.clerkUserId))!;
}

export async function findMembership(
  db: RegistryDb,
  userId: string,
  orgId: string,
) {
  const rows = await db
    .select()
    .from(userMemberships)
    .where(and(eq(userMemberships.userId, userId), eq(userMemberships.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function ensureMembership(
  db: RegistryDb,
  input: {
    id: string;
    userId: string;
    orgId: string;
    role: "owner" | "admin" | "member";
    now: Date;
  },
) {
  const existing = await findMembership(db, input.userId, input.orgId);
  if (existing) return existing;
  await db.insert(userMemberships).values({
    id: input.id,
    userId: input.userId,
    orgId: input.orgId,
    role: input.role,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return findMembership(db, input.userId, input.orgId);
}
