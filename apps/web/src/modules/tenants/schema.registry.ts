import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  d1Binding: text("d1_binding").notNull().unique(),
  d1DatabaseId: text("d1_database_id").notNull(),
  hostname: text("hostname"),
  id: text("id").primaryKey(),
  listed: integer("listed", { mode: "boolean" }).notNull().default(true),
  name: text("name").notNull(),
  orgId: text("org_id").notNull().unique(),
  r2Prefix: text("r2_prefix").notNull(),
  region: text("region", { enum: ["au", "nz"] })
    .notNull()
    .default("au"),
  slug: text("slug").notNull().unique(),
  status: text("status", { enum: ["active", "suspended", "archived"] })
    .notNull()
    .default("active"),
  timezone: text("timezone").notNull().default("Australia/Sydney"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const tenantSettings = sqliteTable("tenant_settings", {
  configJson: text("config_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  fromEmail: text("from_email"),
  gaId: text("ga_id"),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().unique(),
  senderDomain: text("sender_domain"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type TenantRow = typeof tenants.$inferSelect;
