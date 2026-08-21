import { and, eq } from "drizzle-orm";

import { userMemberships, users } from "@/modules/identity/schema.registry";
import type { UserRow } from "@/modules/identity/schema.registry";
import type { RegistryDb } from "@/shared/db/client";

export async function findByClerkId(db: RegistryDb, clerkUserId: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

async function requireByClerkId(db: RegistryDb, clerkUserId: string): Promise<UserRow> {
  const user = await findByClerkId(db, clerkUserId);
  if (!user) {
    throw new Error("User write did not persist");
  }
  return user;
}

export async function findByEmail(db: RegistryDb, email: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
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
        displayName: input.displayName,
        email: input.email,
        imageUrl: input.imageUrl,
        updatedAt: input.now,
      })
      .where(eq(users.id, existing.id));
    return requireByClerkId(db, input.clerkUserId);
  }

  const invited = await findByEmail(db, input.email);
  if (invited?.clerkUserId.startsWith("invite_")) {
    await db
      .update(users)
      .set({
        clerkUserId: input.clerkUserId,
        displayName: input.displayName ?? invited.displayName,
        imageUrl: input.imageUrl ?? invited.imageUrl,
        updatedAt: input.now,
      })
      .where(eq(users.id, invited.id));
    return requireByClerkId(db, input.clerkUserId);
  }

  await db.insert(users).values({
    clerkUserId: input.clerkUserId,
    createdAt: input.now,
    displayName: input.displayName,
    email: input.email,
    id: input.id,
    imageUrl: input.imageUrl,
    isBanned: false,
    isSuperAdmin: false,
    updatedAt: input.now,
  });
  return requireByClerkId(db, input.clerkUserId);
}

export async function listMembershipsForUser(db: RegistryDb, userId: string) {
  return await db.select().from(userMemberships).where(eq(userMemberships.userId, userId));
}

export async function findMembership(db: RegistryDb, userId: string, orgId: string) {
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
  if (existing) {
    return existing;
  }
  await db.insert(userMemberships).values({
    createdAt: input.now,
    id: input.id,
    orgId: input.orgId,
    role: input.role,
    updatedAt: input.now,
    userId: input.userId,
  });
  return findMembership(db, input.userId, input.orgId);
}
