import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const emailCampaigns = sqliteTable("email_campaigns", {
  bodyHtml: text("body_html"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  orgId: text("org_id").notNull(),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  status: text("status", {
    enum: ["draft", "scheduled", "sending", "sent", "cancelled"],
  })
    .notNull()
    .default("draft"),
  subject: text("subject").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const emailTemplates = sqliteTable("email_templates", {
  bodyHtml: text("body_html"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  orgId: text("org_id").notNull(),
  subject: text("subject"),
});

export const emailSends = sqliteTable("email_sends", {
  campaignId: text("campaign_id").references(() => emailCampaigns.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  status: text("status").notNull().default("queued"),
  toEmail: text("to_email").notNull(),
});
