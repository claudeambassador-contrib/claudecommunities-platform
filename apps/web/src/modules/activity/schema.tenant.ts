import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const activities = sqliteTable("activities", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  dataJson: text("data_json"),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  type: text("type").notNull(),
  userId: text("user_id").notNull(),
});
