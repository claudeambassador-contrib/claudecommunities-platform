import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const scheduledCourses = sqliteTable(
  "scheduled_courses",
  {
    city: text("city"),
    courseType: text("course_type").notNull().default("workshop"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    description: text("description"),
    endTime: integer("end_time", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    imageUrl: text("image_url"),
    instructor: text("instructor"),
    isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    location: text("location"),
    maxAttendees: integer("max_attendees"),
    meetingUrl: text("meeting_url"),
    orgId: text("org_id").notNull(),
    price: text("price"),
    registrationUrl: text("registration_url"),
    slug: text("slug").notNull(),
    startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
    timezone: text("timezone"),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("scheduled_courses_org_slug").on(t.orgId, t.slug)],
);

export const courseEnrollments = sqliteTable("course_enrollments", {
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
});
