CREATE TABLE IF NOT EXISTS email_preferences (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentions INTEGER NOT NULL DEFAULT 1,
  replies INTEGER NOT NULL DEFAULT 1,
  likes INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 1,
  weekly_digest INTEGER NOT NULL DEFAULT 1,
  event_reminders INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS email_preferences_user_id ON email_preferences (user_id);
