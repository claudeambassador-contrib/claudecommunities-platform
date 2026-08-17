import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const spaces = sqliteTable("spaces", {
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  description: text("description"),
  icon: text("icon"),
  id: text("id").primaryKey(),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  orgId: text("org_id").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const posts = sqliteTable("posts", {
  authorUserId: text("author_user_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  mediaType: text("media_type"),
  mediaUrl: text("media_url"),
  orgId: text("org_id").notNull(),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
  title: text("title"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const comments = sqliteTable("comments", {
  authorUserId: text("author_user_id").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  parentId: text("parent_id"),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const reactions = sqliteTable(
  "reactions",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    emoji: text("emoji").notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("reactions_post_user_emoji").on(t.postId, t.userId, t.emoji)],
);

export const commentReactions = sqliteTable(
  "comment_reactions",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    emoji: text("emoji").notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("comment_reactions_comment_user_emoji").on(t.commentId, t.userId, t.emoji)],
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("bookmarks_post_user").on(t.postId, t.userId)],
);

export const spaceViews = sqliteTable(
  "space_views",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    spaceId: text("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    viewedAt: integer("viewed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("space_views_space_user").on(t.spaceId, t.userId)],
);

export type PostRow = typeof posts.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type SpaceRow = typeof spaces.$inferSelect;
