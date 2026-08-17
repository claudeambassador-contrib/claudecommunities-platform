-- Per-event speaker fields (stub table only had name/bio/image).
ALTER TABLE speakers ADD COLUMN event_id TEXT;
ALTER TABLE speakers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE speakers ADD COLUMN title TEXT;
ALTER TABLE speakers ADD COLUMN company TEXT;
ALTER TABLE speakers ADD COLUMN talk_title TEXT;
ALTER TABLE speakers ADD COLUMN talk_description TEXT;
ALTER TABLE speakers ADD COLUMN talk_description_short TEXT;
ALTER TABLE speakers ADD COLUMN company_logo_url TEXT;
ALTER TABLE speakers ADD COLUMN twitter_handle TEXT;
ALTER TABLE speakers ADD COLUMN linkedin_url TEXT;
ALTER TABLE speakers ADD COLUMN website_url TEXT;
ALTER TABLE speakers ADD COLUMN submission_id TEXT;
ALTER TABLE speakers ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Recreate talk_submissions so status matches CFP (pending/approved/declined)
-- and the richer submission fields from the Next service.
CREATE TABLE talk_submissions_new (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT,
  bio TEXT,
  city TEXT,
  slides_url TEXT,
  slides_file_name TEXT,
  slides_mime_type TEXT,
  slides_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  content_locked INTEGER NOT NULL DEFAULT 0,
  slides_locked INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO talk_submissions_new (
  id, org_id, user_id, title, description, status, created_at, updated_at
)
SELECT
  id,
  org_id,
  user_id,
  title,
  abstract,
  CASE status
    WHEN 'accepted' THEN 'approved'
    WHEN 'rejected' THEN 'declined'
    WHEN 'withdrawn' THEN 'declined'
    ELSE 'pending'
  END,
  created_at,
  updated_at
FROM talk_submissions;

DROP TABLE talk_submissions;
ALTER TABLE talk_submissions_new RENAME TO talk_submissions;
