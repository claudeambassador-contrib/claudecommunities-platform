import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const speakers = sqliteTable("speakers", {
  bio: text("bio"),
  company: text("company"),
  companyLogoUrl: text("company_logo_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  eventId: text("event_id"),
  id: text("id").primaryKey(),
  imageUrl: text("image_url"),
  linkedinUrl: text("linkedin_url"),
  name: text("name").notNull(),
  orgId: text("org_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  submissionId: text("submission_id"),
  talkDescription: text("talk_description"),
  talkDescriptionShort: text("talk_description_short"),
  talkTitle: text("talk_title"),
  title: text("title"),
  twitterHandle: text("twitter_handle"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
  websiteUrl: text("website_url"),
});

export const talkSubmissions = sqliteTable("talk_submissions", {
  bio: text("bio"),
  city: text("city"),
  contentLocked: integer("content_locked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  description: text("description"),
  email: text("email").notNull().default(""),
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  orgId: text("org_id").notNull(),
  slidesFileName: text("slides_file_name"),
  slidesLocked: integer("slides_locked", { mode: "boolean" }).notNull().default(false),
  slidesMimeType: text("slides_mime_type"),
  slidesSize: integer("slides_size"),
  slidesUrl: text("slides_url"),
  status: text("status", { enum: ["pending", "approved", "declined"] })
    .notNull()
    .default("pending"),
  title: text("title").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  userId: text("user_id"),
});

export const talkComments = sqliteTable("talk_comments", {
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => talkSubmissions.id, { onDelete: "cascade" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type SpeakerRow = typeof speakers.$inferSelect;
export type TalkCommentRow = typeof talkComments.$inferSelect;
export type TalkSubmissionRow = typeof talkSubmissions.$inferSelect;
