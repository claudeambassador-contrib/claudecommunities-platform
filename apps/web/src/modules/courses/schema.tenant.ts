import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const courses = sqliteTable("courses", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  description: text("description"),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  slug: text("slug").notNull(),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  title: text("title").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const lessons = sqliteTable("lessons", {
  body: text("body"),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
});

export const courseEnrollments = sqliteTable("course_enrollments", {
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
});
