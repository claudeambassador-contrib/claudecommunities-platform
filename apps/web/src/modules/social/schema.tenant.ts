import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const socialAccounts = sqliteTable(
  "social_accounts",
  {
    accessTokenEncrypted: text("access_token_encrypted"),
    accountType: text("account_type").notNull().default("organization"),
    avatarUrl: text("avatar_url"),
    connector: text("connector").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    displayName: text("display_name"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    externalId: text("external_id"),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    platform: text("platform").notNull(),
  },
  (t) => [
    uniqueIndex("social_accounts_org_connector_external").on(t.orgId, t.connector, t.externalId),
  ],
);

export const socialPosts = sqliteTable("social_posts", {
  accountId: text("account_id").references(() => socialAccounts.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  createdById: text("created_by_id"),
  errorMessage: text("error_message"),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  id: text("id").primaryKey(),
  mediaType: text("media_type").notNull().default("none"),
  mediaUrls: text("media_urls").notNull().default("[]"),
  orgId: text("org_id").notNull(),
  platform: text("platform").notNull().default("linkedin"),
  publishAttempts: integer("publish_attempts").notNull().default(0),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  status: text("status", {
    enum: ["draft", "scheduled", "publishing", "published", "failed", "cancelled"],
  })
    .notNull()
    .default("draft"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type SocialAccountRow = typeof socialAccounts.$inferSelect;
export type SocialPostRow = typeof socialPosts.$inferSelect;
