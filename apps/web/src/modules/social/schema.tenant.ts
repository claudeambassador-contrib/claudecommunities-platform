import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const socialAccounts = sqliteTable("social_accounts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  connector: text("connector").notNull(),
  platform: text("platform").notNull(),
  displayName: text("display_name"),
  externalId: text("external_id"),
  accessTokenEncrypted: text("access_token_encrypted"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const socialPosts = sqliteTable("social_posts", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  accountId: text("account_id").references(() => socialAccounts.id, {
    onDelete: "set null",
  }),
  body: text("body").notNull(),
  status: text("status", {
    enum: ["draft", "scheduled", "publishing", "published", "failed", "cancelled"],
  })
    .notNull()
    .default("draft"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  externalId: text("external_id"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
