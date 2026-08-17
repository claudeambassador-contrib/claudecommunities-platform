import { and, desc, eq, like, or } from "drizzle-orm";
import type {
  MembershipRole,
  MembershipWrite,
  UserProfile,
  UserSummary,
  UserWrite,
} from "@/modules/identity/types";
import type { RegistryStore } from "@/shared/db/registryStore";
import { newId } from "@/shared/ids";

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function asRole(value: string): MembershipRole {
  if (value === "owner" || value === "admin" || value === "member") {
    return value;
  }
  return "member";
}

export async function insertUser(store: RegistryStore, write: UserWrite): Promise<UserProfile> {
  const { users } = store.tables;
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
  const { userMemberships } = store.tables;
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

export async function findUserById(store: RegistryStore, id: string): Promise<UserProfile | null> {
  const { users } = store.tables;
  const row = first(await store.db.select().from(users).where(eq(users.id, id)).limit(1));
  if (!row) {
    return null;
  }
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

export async function findMembership(
  store: RegistryStore,
  userId: string,
  orgId: string,
): Promise<{ role: MembershipRole; userId: string } | null> {
  const { userMemberships } = store.tables;
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
  const { userMemberships } = store.tables;
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
  const { userMemberships, users } = store.tables;
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
