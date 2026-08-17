import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  city: text("city"),
  coverUrl: text("cover_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  description: text("description"),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  eventType: text("event_type").notNull().default("meetup"),
  feedbackUrl: text("feedback_url"),
  footerText: text("footer_text"),
  headerText: text("header_text"),
  id: text("id").primaryKey(),
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  location: text("location"),
  lumaEventId: text("luma_event_id"),
  lumaUrl: text("luma_url"),
  maxAttendees: integer("max_attendees"),
  meetingUrl: text("meeting_url"),
  orgId: text("org_id").notNull(),
  rsvpEnabled: integer("rsvp_enabled", { mode: "boolean" }).notNull().default(false),
  slug: text("slug").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["draft", "published", "cancelled"] })
    .notNull()
    .default("draft"),
  timezone: text("timezone"),
  title: text("title").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const eventRsvps = sqliteTable(
  "event_rsvps",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    status: text("status", { enum: ["going", "interested"] })
      .notNull()
      .default("going"),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("event_rsvps_event_user").on(t.eventId, t.userId)],
);

export const eventAgendaItems = sqliteTable("event_agenda_items", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  description: text("description"),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  speakerId: text("speaker_id"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  submissionId: text("submission_id"),
  title: text("title"),
  type: text("type", { enum: ["speaker", "welcome", "break", "custom"] })
    .notNull()
    .default("custom"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const eventLumaInterests = sqliteTable(
  "event_luma_interests",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    notifiedAt: integer("notified_at", { mode: "timestamp_ms" }),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("event_luma_interests_event_user").on(t.eventId, t.userId)],
);

export const eventResources = sqliteTable("event_resources", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  description: text("description"),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  id: text("id").primaryKey(),
  mimeType: text("mime_type").notNull(),
  orgId: text("org_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
  uploadedBy: text("uploaded_by"),
});

export type EventRow = typeof events.$inferSelect;
export type EventRsvpRow = typeof eventRsvps.$inferSelect;
export type EventAgendaRow = typeof eventAgendaItems.$inferSelect;
