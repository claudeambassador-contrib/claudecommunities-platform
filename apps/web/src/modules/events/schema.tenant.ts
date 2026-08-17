import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  coverUrl: text("cover_url"),
  status: text("status", { enum: ["draft", "published", "cancelled"] })
    .notNull()
    .default("draft"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const eventRsvps = sqliteTable(
  "event_rsvps",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    status: text("status", { enum: ["going", "waitlist", "cancelled"] })
      .notNull()
      .default("going"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("event_rsvps_event_user").on(t.eventId, t.userId)],
);

export const eventAgendaItems = sqliteTable("event_agenda_items", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type EventRow = typeof events.$inferSelect;
