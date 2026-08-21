ALTER TABLE email_sends ADD COLUMN external_id TEXT;
CREATE INDEX IF NOT EXISTS email_sends_external_id_idx ON email_sends (external_id);
