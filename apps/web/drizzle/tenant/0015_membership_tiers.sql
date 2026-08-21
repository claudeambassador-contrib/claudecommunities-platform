CREATE TABLE IF NOT EXISTS membership_tiers (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  yearly_price REAL,
  features_json TEXT NOT NULL DEFAULT '[]',
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS membership_tiers_org_name ON membership_tiers (org_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS membership_tiers_org_slug ON membership_tiers (org_id, slug);
CREATE INDEX IF NOT EXISTS membership_tiers_org_order_idx ON membership_tiers (org_id, sort_order);
