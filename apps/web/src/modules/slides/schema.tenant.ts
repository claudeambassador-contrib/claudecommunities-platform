import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const slideGeneratorStates = sqliteTable("slide_generator_states", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  eventId: text("event_id"),
  stateJson: text("state_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const slideExportJobs = sqliteTable("slide_export_jobs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  status: text("status", {
    enum: ["queued", "running", "completed", "failed"],
  })
    .notNull()
    .default("queued"),
  resultKey: text("result_key"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
