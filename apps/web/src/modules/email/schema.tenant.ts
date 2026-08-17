import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const emailCampaigns = sqliteTable("email_campaigns", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html"),
  status: text("status", {
    enum: ["draft", "scheduled", "sending", "sent", "cancelled"],
  })
    .notNull()
    .default("draft"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const emailTemplates = sqliteTable("email_templates", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject"),
  bodyHtml: text("body_html"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const emailSends = sqliteTable("email_sends", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  campaignId: text("campaign_id").references(() => emailCampaigns.id, {
    onDelete: "set null",
  }),
  toEmail: text("to_email").notNull(),
  status: text("status").notNull().default("queued"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
