CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  state_full TEXT NOT NULL,
  description TEXT NOT NULL,
  is_capital INTEGER NOT NULL DEFAULT 0,
  keywords_json TEXT NOT NULL DEFAULT '[]',
  timezone TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cities_org_slug ON cities (org_id, slug);
CREATE INDEX IF NOT EXISTS cities_org_position_idx ON cities (org_id, position);
