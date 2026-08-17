import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  hostname: text("hostname"),
  d1Binding: text("d1_binding").notNull().unique(),
  d1DatabaseId: text("d1_database_id").notNull(),
  r2Prefix: text("r2_prefix").notNull(),
  status: text("status", { enum: ["active", "suspended", "archived"] })
    .notNull()
    .default("active"),
  listed: integer("listed", { mode: "boolean" }).notNull().default(true),
  region: text("region", { enum: ["au", "nz"] }).notNull().default("au"),
  timezone: text("timezone").notNull().default("Australia/Sydney"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const tenantSettings = sqliteTable("tenant_settings", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().unique(),
  configJson: text("config_json").notNull().default("{}"),
  gaId: text("ga_id"),
  fromEmail: text("from_email"),
  senderDomain: text("sender_domain"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type TenantRow = typeof tenants.$inferSelect;
