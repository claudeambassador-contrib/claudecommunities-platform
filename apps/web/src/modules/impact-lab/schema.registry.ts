import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** Impact Lab stays on the registry D1 (global), not city D1. */
export const impactLabInterests = sqliteTable("impact_lab_interests", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  orgId: text("org_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const impactLabSponsors = sqliteTable("impact_lab_sponsors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  logoUrl: text("logo_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
