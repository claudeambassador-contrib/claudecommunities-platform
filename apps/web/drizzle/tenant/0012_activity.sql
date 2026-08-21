CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_org_created_idx ON activities (org_id, created_at);
CREATE INDEX IF NOT EXISTS activities_org_user_idx ON activities (org_id, user_id);
