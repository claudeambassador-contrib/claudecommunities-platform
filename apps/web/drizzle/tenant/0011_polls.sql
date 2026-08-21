CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  question TEXT NOT NULL,
  post_id TEXT,
  ends_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS polls_org_post ON polls (org_id, post_id) WHERE post_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS poll_options_poll_idx ON poll_options (org_id, poll_id);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_org_user_poll ON poll_votes (org_id, user_id, poll_id);
