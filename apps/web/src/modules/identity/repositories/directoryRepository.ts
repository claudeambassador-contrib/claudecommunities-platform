import { and, desc, eq, inArray, like, or } from "drizzle-orm";

import type {
  MembershipRole,
  MembershipWrite,
  UserProfile,
  UserSummary,
  UserWrite,
} from "@/modules/identity/types";
import type { RegistryTables } from "@/shared/db/registrySchema";
import type { RegistryStore } from "@/shared/db/registryStore";
import { first } from "@/shared/db/rows";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type DirectoryTables = Pick<RegistryTables, "emailPreferences" | "userMemberships" | "users">;
const tables = (store: RegistryStore): DirectoryTables => store.tables;

function asRole(value: string): MembershipRole {
  if (value === "owner" || value === "admin" || value === "member") {
    return value;
  }
  return "member";
}

export async function insertUser(store: RegistryStore, write: UserWrite): Promise<UserProfile> {
  const { users } = tables(store);
  const now = new Date();
  const id = write.id ?? newId("usr");
  await store.db.insert(users).values({
    clerkUserId: write.clerkUserId,
    createdAt: now,
    displayName: write.displayName ?? null,
    email: write.email.toLowerCase(),
    id,
    imageUrl: write.imageUrl ?? null,
    isBanned: false,
    isSuperAdmin: false,
    updatedAt: now,
  });
  const user = await findUserById(store, id);
  if (!user) {
    throw new Error("insert user failed");
  }
  return user;
}

export async function insertMembership(
  store: RegistryStore,
  write: MembershipWrite,
): Promise<void> {
  const { userMemberships } = tables(store);
  const now = new Date();
  await store.db.insert(userMemberships).values({
    createdAt: now,
    id: newId("mem"),
    orgId: write.orgId,
    role: write.role ?? "member",
    updatedAt: now,
    userId: write.userId,
  });
}

function toProfile(row: {
  createdAt: Date;
  displayName: string | null;
  email: string;
  id: string;
  imageUrl: string | null;
  isBanned: boolean;
  isSuperAdmin: boolean;
}): UserProfile {
  return {
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    email: row.email,
    id: row.id,
    imageUrl: row.imageUrl,
    isBanned: Boolean(row.isBanned),
    isSuperAdmin: Boolean(row.isSuperAdmin),
    role: null,
  };
}

export async function findUserById(store: RegistryStore, id: string): Promise<UserProfile | null> {
  const { users } = tables(store);
  const row = first(await store.db.select().from(users).where(eq(users.id, id)).limit(1));
  if (!row) {
    return null;
  }
  return toProfile(row);
}

export async function findUserByEmail(
  store: RegistryStore,
  email: string,
): Promise<UserProfile | null> {
  const { users } = tables(store);
  const row = first(
    await store.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1),
  );
  if (!row) {
    return null;
  }
  return toProfile(row);
}

export async function updateUserProfile(
  store: RegistryStore,
  id: string,
  patch: { displayName: string },
): Promise<UserProfile | null> {
  const { users } = tables(store);
  await store.db
    .update(users)
    .set({ displayName: patch.displayName, updatedAt: new Date() })
    .where(eq(users.id, id));
  return findUserById(store, id);
}

export async function listInvitedMembers(
  store: RegistryStore,
  orgId: string,
): Promise<
  {
    createdAt: string;
    displayName: string | null;
    email: string;
    hasSignedUp: boolean;
    id: string;
  }[]
> {
  const { userMemberships, users } = tables(store);
  const rows = await store.db
    .select({
      clerkUserId: users.clerkUserId,
      createdAt: userMemberships.createdAt,
      displayName: users.displayName,
      email: users.email,
      id: users.id,
    })
    .from(userMemberships)
    .innerJoin(users, eq(users.id, userMemberships.userId))
    .where(and(eq(userMemberships.orgId, orgId), like(users.clerkUserId, "invite_%")))
    .orderBy(desc(userMemberships.createdAt));
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    email: row.email,
    hasSignedUp: !row.clerkUserId.startsWith("invite_"),
    id: row.id,
  }));
}

export async function findUsersByIds(
  store: RegistryStore,
  ids: readonly string[],
): Promise<UserProfile[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }
  const { users } = tables(store);
  const rows = await store.db.select().from(users).where(inArray(users.id, unique));
  return rows.map(toProfile);
}

export async function findMembership(
  store: RegistryStore,
  userId: string,
  orgId: string,
): Promise<{ role: MembershipRole; userId: string } | null> {
  const { userMemberships } = tables(store);
  const row = first(
    await store.db
      .select()
      .from(userMemberships)
      .where(and(eq(userMemberships.orgId, orgId), eq(userMemberships.userId, userId)))
      .limit(1),
  );
  if (!row) {
    return null;
  }
  return { role: asRole(row.role), userId: row.userId };
}

export async function updateMembershipRole(
  store: RegistryStore,
  orgId: string,
  userId: string,
  role: MembershipRole,
): Promise<boolean> {
  const { userMemberships } = tables(store);
  const result = await store.db
    .update(userMemberships)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(userMemberships.orgId, orgId), eq(userMemberships.userId, userId)))
    .returning({ id: userMemberships.id });
  return Boolean(first(result));
}

export async function listOrgMembers(
  store: RegistryStore,
  orgId: string,
  options: { limit: number; offset: number; search?: string },
): Promise<UserSummary[]> {
  const { userMemberships, users } = tables(store);
  const filters = [eq(userMemberships.orgId, orgId)];
  if (options.search?.trim()) {
    const q = `%${options.search.trim()}%`;
    const match = or(like(users.displayName, q), like(users.email, q));
    if (match) {
      filters.push(match);
    }
  }
  const rows = await store.db
    .select({
      createdAt: users.createdAt,
      displayName: users.displayName,
      email: users.email,
      id: users.id,
      imageUrl: users.imageUrl,
      role: userMemberships.role,
    })
    .from(userMemberships)
    .innerJoin(users, eq(users.id, userMemberships.userId))
    .where(and(...filters))
    .orderBy(desc(users.createdAt))
    .limit(options.limit)
    .offset(options.offset);
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    email: row.email,
    id: row.id,
    imageUrl: row.imageUrl,
    role: asRole(row.role),
  }));
}

/** Members who can receive campaign mail: not banned, has an email, not unsubscribed. */
export async function listOrgRecipients(
  store: RegistryStore,
  orgId: string,
): Promise<{ email: string; id: string }[]> {
  const { emailPreferences, userMemberships, users } = tables(store);
  const rows = await store.db
    .select({
      email: users.email,
      id: users.id,
      isBanned: users.isBanned,
      weeklyDigest: emailPreferences.weeklyDigest,
    })
    .from(userMemberships)
    .innerJoin(users, eq(users.id, userMemberships.userId))
    .leftJoin(emailPreferences, eq(emailPreferences.userId, users.id))
    .where(eq(userMemberships.orgId, orgId));
  return rows
    .filter((row) => !row.isBanned && row.weeklyDigest !== false && row.email.includes("@"))
    .map((row) => ({ email: row.email.toLowerCase(), id: row.id }));
}
