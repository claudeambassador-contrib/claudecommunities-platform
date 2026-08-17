import { and, desc, eq } from "drizzle-orm";
import type { TenantStore } from "@/shared/db/tenantStore";
import type { PostRow } from "@/modules/community/schema.tenant";
import { newId } from "@/shared/ids";

export async function listRecent(store: TenantStore, limit = 50): Promise<PostRow[]> {
  const { posts } = store.tables;
  return store.db
    .select()
    .from(posts)
    .where(eq(posts.orgId, store.orgId))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export async function insertPost(
  store: TenantStore,
  input: { authorUserId: string; body: string; spaceId?: string | null },
): Promise<PostRow> {
  const { posts } = store.tables;
  const now = new Date();
  const id = newId("post");
  await store.db.insert(posts).values({
    id,
    orgId: store.orgId,
    spaceId: input.spaceId ?? null,
    authorUserId: input.authorUserId,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await store.db
    .select()
    .from(posts)
    .where(and(eq(posts.orgId, store.orgId), eq(posts.id, id)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("insert post failed");
  return row;
}
