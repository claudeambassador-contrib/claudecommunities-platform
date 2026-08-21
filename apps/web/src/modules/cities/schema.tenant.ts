import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const cities = sqliteTable(
  "cities",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    description: text("description").notNull(),
    id: text("id").primaryKey(),
    isCapital: integer("is_capital", { mode: "boolean" }).notNull().default(false),
    keywordsJson: text("keywords_json").notNull().default("[]"),
    name: text("name").notNull(),
    orgId: text("org_id").notNull(),
    position: integer("position").notNull().default(0),
    slug: text("slug").notNull(),
    state: text("state").notNull(),
    stateFull: text("state_full").notNull(),
    timezone: text("timezone").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("cities_org_slug").on(t.orgId, t.slug)],
);
