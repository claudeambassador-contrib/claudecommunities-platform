CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_org_connector_external
  ON social_accounts (org_id, connector, external_id);
