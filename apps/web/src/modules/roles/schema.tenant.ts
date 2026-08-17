import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const roles = sqliteTable(
  "roles",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    name: text("name").notNull(),
    orgId: text("org_id").notNull(),
    permissionsJson: text("permissions_json").notNull().default("[]"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("roles_org_name").on(t.orgId, t.name)],
);
