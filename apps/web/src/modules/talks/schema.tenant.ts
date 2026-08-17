import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const speakers = sqliteTable("speakers", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  bio: text("bio"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const talkSubmissions = sqliteTable("talk_submissions", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  abstract: text("abstract"),
  status: text("status", {
    enum: ["draft", "submitted", "accepted", "rejected", "withdrawn"],
  })
    .notNull()
    .default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
