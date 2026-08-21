import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const membershipTiers = sqliteTable(
  "membership_tiers",
  {
    color: text("color"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    description: text("description"),
    featuresJson: text("features_json").notNull().default("[]"),
    id: text("id").primaryKey(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    name: text("name").notNull(),
    order: integer("sort_order").notNull().default(0),
    orgId: text("org_id").notNull(),
    price: real("price").notNull().default(0),
    slug: text("slug").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    yearlyPrice: real("yearly_price"),
  },
  (t) => [
    uniqueIndex("membership_tiers_org_name").on(t.orgId, t.name),
    uniqueIndex("membership_tiers_org_slug").on(t.orgId, t.slug),
  ],
);
