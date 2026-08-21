import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Impact Lab stays on the registry D1 (global), not city D1. */
export const impactLabInterests = sqliteTable("impact_lab_interests", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  email: text("email").notNull(),
  id: text("id").primaryKey(),
  name: text("name"),
  orgId: text("org_id"),
});

export const impactLabSponsors = sqliteTable("impact_lab_sponsors", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey(),
  logoUrl: text("logo_url"),
  name: text("name").notNull(),
  website: text("website"),
});

export const impactLabConfig = sqliteTable("impact_lab_config", {
  accessCode: text("access_code").notNull().default("IMPACTLAB"),
  adminPassword: text("admin_password").notNull().default("hackday-admin"),
  adminToken: text("admin_token"),
  checkInOpen: integer("check_in_open", { mode: "boolean" }).notNull().default(true),
  coffeeNote: text("coffee_note")
    .notNull()
    .default("Show this code at the coffee cart to claim your cup. One redemption per person."),
  eventDate: text("event_date").notNull().default("23 May 2026"),
  eventName: text("event_name").notNull().default("Claude Impact Lab"),
  eventTagline: text("event_tagline").notNull().default("Build AI for your city — in a day."),
  id: text("id").primaryKey(),
  peoplesChoiceOpen: integer("peoples_choice_open", { mode: "boolean" }).notNull().default(false),
  peoplesChoiceWinnerTeamId: text("peoples_choice_winner_team_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  votingOpen: integer("voting_open", { mode: "boolean" }).notNull().default(false),
  winningStatementId: text("winning_statement_id"),
});

export const impactLabTeams = sqliteTable(
  "impact_lab_teams",
  {
    color: text("color").notNull().default("#D4836A"),
    conceptRepoUrl: text("concept_repo_url"),
    conceptSubmittedAt: integer("concept_submitted_at", { mode: "timestamp_ms" }),
    conceptSummary: text("concept_summary"),
    conceptTitle: text("concept_title"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tableNumber: text("table_number"),
  },
  (t) => [uniqueIndex("impact_lab_teams_name").on(t.name)],
);

export const impactLabParticipants = sqliteTable(
  "impact_lab_participants",
  {
    checkedIn: integer("checked_in", { mode: "boolean" }).notNull().default(false),
    checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }),
    coffeeCode: text("coffee_code").notNull(),
    coffeeRedeemed: integer("coffee_redeemed", { mode: "boolean" }).notNull().default(false),
    coffeeRedeemedAt: integer("coffee_redeemed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    email: text("email").notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    preRegistered: integer("pre_registered", { mode: "boolean" }).notNull().default(false),
    role: text("role").notNull().default("participant"),
    sessionToken: text("session_token"),
    teamId: text("team_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("impact_lab_participants_coffee").on(t.coffeeCode),
    uniqueIndex("impact_lab_participants_email").on(t.email),
    uniqueIndex("impact_lab_participants_session").on(t.sessionToken),
  ],
);

export const impactLabCoffeeCodes = sqliteTable(
  "impact_lab_coffee_codes",
  {
    code: text("code").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    participantId: text("participant_id"),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    uniqueIndex("impact_lab_coffee_codes_code").on(t.code),
    uniqueIndex("impact_lab_coffee_codes_order").on(t.sortOrder),
    uniqueIndex("impact_lab_coffee_codes_participant").on(t.participantId),
  ],
);

export const impactLabStatements = sqliteTable("impact_lab_statements", {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  description: text("description").notNull(),
  id: text("id").primaryKey(),
  sortOrder: integer("sort_order").notNull().default(0),
  summary: text("summary").notNull(),
  title: text("title").notNull(),
});

export const impactLabVotes = sqliteTable(
  "impact_lab_votes",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    participantId: text("participant_id").notNull(),
    statementId: text("statement_id").notNull(),
  },
  (t) => [uniqueIndex("impact_lab_votes_participant").on(t.participantId)],
);
