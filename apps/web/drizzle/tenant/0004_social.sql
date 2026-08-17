ALTER TABLE social_accounts ADD COLUMN avatar_url TEXT;
ALTER TABLE social_accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'organization';
ALTER TABLE social_accounts ADD COLUMN expires_at INTEGER;

ALTER TABLE social_posts ADD COLUMN platform TEXT NOT NULL DEFAULT 'linkedin';
ALTER TABLE social_posts ADD COLUMN media_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE social_posts ADD COLUMN media_urls TEXT NOT NULL DEFAULT '[]';
ALTER TABLE social_posts ADD COLUMN published_at INTEGER;
ALTER TABLE social_posts ADD COLUMN external_url TEXT;
ALTER TABLE social_posts ADD COLUMN created_by_id TEXT;
ALTER TABLE social_posts ADD COLUMN publish_attempts INTEGER NOT NULL DEFAULT 0;
