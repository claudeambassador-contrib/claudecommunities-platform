import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const pages = sqliteTable(
  "pages",
  {
    bodyJson: text("body_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("pages_org_slug").on(t.orgId, t.slug)],
);

export const notifications = sqliteTable("notifications", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  type: text("type").notNull(),
  userId: text("user_id").notNull(),
});
