import { and, desc, eq } from "drizzle-orm";

import type {
  ActivityItem,
  ListActivityOptions,
  RecordActivityInput,
} from "@/modules/activity/types";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type ActivityTables = Pick<TenantTables, "activities">;
const tables = (store: TenantStore): ActivityTables => store.tables;

function parseData(raw: string | null): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function insertActivity(
  store: TenantStore,
  input: RecordActivityInput,
): Promise<ActivityItem> {
  const { activities } = tables(store);
  const now = new Date();
  const id = newId("act");
  const dataJson = input.data ? JSON.stringify(input.data) : null;
  await store.db.insert(activities).values({
    createdAt: now,
    dataJson,
    id,
    orgId: store.orgId,
    type: input.type,
    userId: input.userId,
  });
  return {
    createdAt: now.toISOString(),
    data: input.data ?? null,
    id,
    type: input.type,
    userId: input.userId,
  };
}

export async function listActivities(
  store: TenantStore,
  options: ListActivityOptions = {},
): Promise<ActivityItem[]> {
  const { activities } = tables(store);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const offset = Math.max(0, options.offset ?? 0);
  const filters = [eq(activities.orgId, store.orgId)];
  if (options.userId) {
    filters.push(eq(activities.userId, options.userId));
  }
  const rows = await store.db
    .select()
    .from(activities)
    .where(and(...filters))
    .orderBy(desc(activities.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    data: parseData(row.dataJson),
    id: row.id,
    type: row.type,
    userId: row.userId,
  }));
}
