CREATE UNIQUE INDEX IF NOT EXISTS badges_org_name ON badges (org_id, name);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_org_user_badge ON user_badges (org_id, user_id, badge_id);
CREATE INDEX IF NOT EXISTS user_badges_badge_idx ON user_badges (badge_id);
