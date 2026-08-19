CREATE TABLE IF NOT EXISTS email_automations (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('signup', 'event_rsvp', 'manual')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS email_automations_org_name ON email_automations (org_id, name);
CREATE INDEX IF NOT EXISTS email_automations_org_idx ON email_automations (org_id);

CREATE TABLE IF NOT EXISTS email_settings (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL DEFAULT '',
  track_opens INTEGER NOT NULL DEFAULT 1,
  track_clicks INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS email_settings_org ON email_settings (org_id);
