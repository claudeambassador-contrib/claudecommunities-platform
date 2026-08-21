CREATE TABLE IF NOT EXISTS talk_comments (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  submission_id TEXT NOT NULL REFERENCES talk_submissions(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS talk_comments_submission_idx ON talk_comments (org_id, submission_id);
