import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  clerkUserId: text("clerk_user_id").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  displayName: text("display_name"),
  email: text("email").notNull(),
  id: text("id").primaryKey(),
  imageUrl: text("image_url"),
  isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
  isSuperAdmin: integer("is_super_admin", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const userMemberships = sqliteTable(
  "user_memberships",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("user_memberships_user_org").on(t.userId, t.orgId)],
);

export const pendingAdminGrants = sqliteTable(
  "pending_admin_grants",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    role: text("role", { enum: ["owner", "admin"] })
      .notNull()
      .default("admin"),
  },
  (t) => [uniqueIndex("pending_admin_grants_org_email").on(t.orgId, t.email)],
);

export const auditLog = sqliteTable("audit_log", {
  action: text("action").notNull(),
  actorUserId: text("actor_user_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  metaJson: text("meta_json").notNull().default("{}"),
});

export const emailPreferences = sqliteTable(
  "email_preferences",
  {
    eventReminders: integer("event_reminders", { mode: "boolean" }).notNull().default(true),
    id: text("id").primaryKey(),
    likes: integer("likes", { mode: "boolean" }).notNull().default(false),
    mentions: integer("mentions", { mode: "boolean" }).notNull().default(true),
    messages: integer("messages", { mode: "boolean" }).notNull().default(true),
    replies: integer("replies", { mode: "boolean" }).notNull().default(true),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weeklyDigest: integer("weekly_digest", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("email_preferences_user_id").on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type MembershipRow = typeof userMemberships.$inferSelect;
export type EmailPreferenceRow = typeof emailPreferences.$inferSelect;
