#!/usr/bin/env node
/**
 * Provision a city for local/staging:
 * 1. Print wrangler d1 create command (remote) or use local binding name
 * 2. Insert registry row via a SQL file for wrangler d1 execute
 *
 * Usage:
 *   node scripts/provision-city.mjs sydney "Sydney" au
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const [slugRaw, nameRaw, regionRaw = "au"] = process.argv.slice(2);
if (!slugRaw || !nameRaw) {
  console.error('Usage: node scripts/provision-city.mjs <slug> "<Name>" [au|nz]');
  process.exit(1);
}

const slug = slugRaw
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const name = nameRaw.trim();
const region = regionRaw === "nz" ? "nz" : "au";
const binding = `TENANT_${slug.replace(/-/g, "_").toUpperCase()}`;
const orgId = randomUUID().replace(/-/g, "").slice(0, 12);
const now = Date.now();
const tenantId = `ten_${randomUUID()}`;
const settingsId = `tset_${randomUUID()}`;
const r2Prefix = `tenants/${slug}`;

const sql = `-- provision ${slug}
INSERT INTO tenants (
  id, org_id, slug, name, hostname, d1_binding, d1_database_id, r2_prefix,
  status, listed, region, timezone, created_at, updated_at
) VALUES (
  '${tenantId}', '${orgId}', '${slug}', '${name.replace(/'/g, "''")}', NULL,
  '${binding}', 'pending-${slug}', '${r2Prefix}',
  'active', 1, '${region}', 'Australia/Sydney', ${now}, ${now}
);

INSERT INTO tenant_settings (id, org_id, config_json, created_at, updated_at)
VALUES ('${settingsId}', '${orgId}', '{}', ${now}, ${now});
`;

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(APP, `scripts/.provision-${slug}.sql`);
writeFileSync(out, sql);

console.log(`Wrote ${out}`);
console.log(`
Next steps:
  1. Ensure wrangler.jsonc has binding ${binding}
  2. bunx wrangler d1 migrations apply REGISTRY --local
  3. bunx wrangler d1 migrations apply ${binding} --local
  4. bunx wrangler d1 execute REGISTRY --local --file=${out}
  5. Redeploy after adding the binding for remote staging
`);
