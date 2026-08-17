CREATE TABLE IF NOT EXISTS impact_lab_config (
  id TEXT PRIMARY KEY NOT NULL,
  event_name TEXT NOT NULL DEFAULT 'Claude Impact Lab',
  event_tagline TEXT NOT NULL DEFAULT 'Build AI for your city — in a day.',
  event_date TEXT NOT NULL DEFAULT '23 May 2026',
  access_code TEXT NOT NULL DEFAULT 'IMPACTLAB',
  admin_password TEXT NOT NULL DEFAULT 'hackday-admin',
  admin_token TEXT,
  check_in_open INTEGER NOT NULL DEFAULT 1,
  voting_open INTEGER NOT NULL DEFAULT 0,
  winning_statement_id TEXT,
  peoples_choice_open INTEGER NOT NULL DEFAULT 0,
  peoples_choice_winner_team_id TEXT,
  coffee_note TEXT NOT NULL DEFAULT 'Show this code at the coffee cart to claim your cup. One redemption per person.',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impact_lab_teams (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4836A',
  table_number TEXT,
  concept_title TEXT,
  concept_summary TEXT,
  concept_repo_url TEXT,
  concept_submitted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_teams_name ON impact_lab_teams (name);

CREATE TABLE IF NOT EXISTS impact_lab_participants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant',
  team_id TEXT REFERENCES impact_lab_teams(id),
  coffee_code TEXT NOT NULL,
  coffee_redeemed INTEGER NOT NULL DEFAULT 0,
  coffee_redeemed_at INTEGER,
  checked_in INTEGER NOT NULL DEFAULT 0,
  checked_in_at INTEGER,
  session_token TEXT,
  pre_registered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_participants_email ON impact_lab_participants (email);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_participants_coffee ON impact_lab_participants (coffee_code);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_participants_session ON impact_lab_participants (session_token);

CREATE TABLE IF NOT EXISTS impact_lab_coffee_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  participant_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_coffee_codes_code ON impact_lab_coffee_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_coffee_codes_order ON impact_lab_coffee_codes (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_coffee_codes_participant ON impact_lab_coffee_codes (participant_id);

CREATE TABLE IF NOT EXISTS impact_lab_statements (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impact_lab_votes (
  id TEXT PRIMARY KEY NOT NULL,
  participant_id TEXT NOT NULL,
  statement_id TEXT NOT NULL REFERENCES impact_lab_statements(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS impact_lab_votes_participant ON impact_lab_votes (participant_id);
