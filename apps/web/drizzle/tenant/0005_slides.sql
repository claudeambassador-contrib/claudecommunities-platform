ALTER TABLE slide_generator_states ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';
CREATE UNIQUE INDEX IF NOT EXISTS slide_generator_states_org_scope
  ON slide_generator_states (org_id, scope);

ALTER TABLE slide_export_jobs ADD COLUMN event_id TEXT;
ALTER TABLE slide_export_jobs ADD COLUMN user_id TEXT;
ALTER TABLE slide_export_jobs ADD COLUMN params_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE slide_export_jobs ADD COLUMN total_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE slide_export_jobs ADD COLUMN completed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE slide_export_jobs ADD COLUMN output_kind TEXT;

CREATE TABLE IF NOT EXISTS slide_style_presets (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS slide_style_presets_org_name
  ON slide_style_presets (org_id, name);
