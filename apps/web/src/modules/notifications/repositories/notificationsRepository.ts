import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type {
  NotificationItem,
  NotificationPayload,
  NotificationWrite,
} from "@/modules/notifications/types";
import { first } from "@/shared/db/rows";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type NotificationsTables = Pick<TenantTables, "notifications">;
const tables = (store: TenantStore): NotificationsTables => store.tables;

function parsePayload(raw: string): NotificationPayload {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { message: "", title: "" };
    }
    const record = parsed as Record<string, unknown>;
    return {
      link: typeof record.link === "string" ? record.link : null,
      message: typeof record.message === "string" ? record.message : "",
      title: typeof record.title === "string" ? record.title : "",
    };
  } catch {
    return { message: "", title: "" };
  }
}

function toItem(row: {
  createdAt: Date;
  id: string;
  payloadJson: string;
  readAt: Date | null;
  type: string;
  userId: string;
}): NotificationItem {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    payload: parsePayload(row.payloadJson),
    readAt: row.readAt ? row.readAt.toISOString() : null,
    type: row.type,
    userId: row.userId,
  };
}

export async function listForUser(
  store: TenantStore,
  userId: string,
  options: { limit: number; unreadOnly: boolean },
): Promise<NotificationItem[]> {
  const { notifications } = tables(store);
  const filters = [eq(notifications.orgId, store.orgId), eq(notifications.userId, userId)];
  if (options.unreadOnly) {
    filters.push(isNull(notifications.readAt));
  }
  const rows = await store.db
    .select()
    .from(notifications)
    .where(and(...filters))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit);
  return rows.map(toItem);
}

export async function countUnread(store: TenantStore, userId: string): Promise<number> {
  const { notifications } = tables(store);
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.orgId, store.orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
  return Number(first(rows)?.n ?? 0);
}

export async function insertNotification(
  store: TenantStore,
  write: NotificationWrite,
): Promise<NotificationItem> {
  const { notifications } = tables(store);
  const now = new Date();
  const id = newId("ntf");
  await store.db.insert(notifications).values({
    createdAt: now,
    id,
    orgId: store.orgId,
    payloadJson: JSON.stringify(write.payload),
    readAt: null,
    type: write.type,
    userId: write.userId,
  });
  return {
    createdAt: now.toISOString(),
    id,
    payload: write.payload,
    readAt: null,
    type: write.type,
    userId: write.userId,
  };
}

export async function markAllRead(store: TenantStore, userId: string): Promise<void> {
  const { notifications } = tables(store);
  const now = new Date();
  await store.db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.orgId, store.orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
}
