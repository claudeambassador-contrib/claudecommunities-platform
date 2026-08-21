import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable(
  "connections",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    receiverId: text("receiver_id").notNull(),
    requesterId: text("requester_id").notNull(),
    status: text("status", { enum: ["accepted", "pending", "rejected"] })
      .notNull()
      .default("pending"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("connections_org_pair").on(t.orgId, t.requesterId, t.receiverId)],
);
