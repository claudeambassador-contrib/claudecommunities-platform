import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const slideGeneratorStates = sqliteTable(
  "slide_generator_states",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    eventId: text("event_id"),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    scope: text("scope").notNull().default("global"),
    stateJson: text("state_json").notNull().default("{}"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("slide_generator_states_org_scope").on(t.orgId, t.scope)],
);

export const slideStylePresets = sqliteTable(
  "slide_style_presets",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    dataJson: text("data_json").notNull().default("{}"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    orgId: text("org_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("slide_style_presets_org_name").on(t.orgId, t.name)],
);

export const slideExportJobs = sqliteTable("slide_export_jobs", {
  completedCount: integer("completed_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  errorMessage: text("error_message"),
  eventId: text("event_id"),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  outputKind: text("output_kind"),
  paramsJson: text("params_json").notNull().default("{}"),
  resultKey: text("result_key"),
  status: text("status", {
    enum: ["queued", "running", "completed", "failed"],
  })
    .notNull()
    .default("queued"),
  totalCount: integer("total_count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  userId: text("user_id"),
});
