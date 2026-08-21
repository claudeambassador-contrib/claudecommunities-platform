import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  externalId: text("external_id"),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  status: text("status").notNull().default("queued"),
  toEmail: text("to_email").notNull(),
});

export const emailAutomations = sqliteTable(
  "email_automations",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    orgId: text("org_id").notNull(),
    status: text("status", { enum: ["draft", "active", "paused"] })
      .notNull()
      .default("draft"),
    triggerType: text("trigger_type", { enum: ["signup", "event_rsvp", "manual"] }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("email_automations_org_name").on(t.orgId, t.name)],
);

export const emailSettings = sqliteTable(
  "email_settings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    senderEmail: text("sender_email").notNull().default(""),
    senderName: text("sender_name").notNull().default(""),
    trackClicks: integer("track_clicks", { mode: "boolean" }).notNull().default(true),
    trackOpens: integer("track_opens", { mode: "boolean" }).notNull().default(true),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("email_settings_org").on(t.orgId)],
);
