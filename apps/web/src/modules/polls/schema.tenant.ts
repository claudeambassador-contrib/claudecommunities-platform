import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const polls = sqliteTable(
  "polls",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    postId: text("post_id"),
    question: text("question").notNull(),
  },
  (t) => [uniqueIndex("polls_org_post").on(t.orgId, t.postId)],
);

export const pollOptions = sqliteTable("poll_options", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  pollId: text("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  text: text("text").notNull(),
});

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    orgId: text("org_id").notNull(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("poll_votes_org_user_poll").on(t.orgId, t.userId, t.pollId)],
);
