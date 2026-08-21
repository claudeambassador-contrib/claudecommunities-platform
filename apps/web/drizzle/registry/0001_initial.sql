-- Flattened registry baseline (early staging — disposable).
-- Control plane only: tenants, identity, impact lab.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hostname TEXT UNIQUE,
  d1_binding TEXT NOT NULL UNIQUE,
  d1_database_id TEXT NOT NULL,
  r2_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  listed INTEGER NOT NULL DEFAULT 1,
  region TEXT NOT NULL DEFAULT 'au' CHECK (region IN ('au', 'nz')),
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);
CREATE INDEX IF NOT EXISTS tenants_hostname_idx ON tenants (hostname);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL UNIQUE,
  config_json TEXT NOT NULL DEFAULT '{}',
  ga_id TEXT,
  from_email TEXT,
  sender_domain TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  image_url TEXT,
  is_banned INTEGER NOT NULL DEFAULT 0,
  is_super_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS user_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_memberships_user_org ON user_memberships (user_id, org_id);
CREATE INDEX IF NOT EXISTS user_memberships_org_idx ON user_memberships (org_id);

CREATE TABLE IF NOT EXISTS pending_admin_grants (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_admin_grants_org_email ON pending_admin_grants (org_id, email);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impact_lab_interests (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  org_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS impact_lab_sponsors (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  created_at INTEGER NOT NULL
);
