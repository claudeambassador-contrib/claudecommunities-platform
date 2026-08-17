import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const badges = sqliteTable(
  "badges",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    imageUrl: text("image_url"),
    name: text("name").notNull(),
    orgId: text("org_id").notNull(),
  },
  (t) => [uniqueIndex("badges_org_name").on(t.orgId, t.name)],
);

export const userBadges = sqliteTable(
  "user_badges",
  {
    awardedAt: integer("awarded_at", { mode: "timestamp_ms" }).notNull(),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("user_badges_org_user_badge").on(t.orgId, t.userId, t.badgeId)],
);
