/**
 * Schema codemod: add tenant scoping to every TENANT_SCOPED model in
 * prisma/schema.prisma, driven by the model→scope map (single source of truth).
 *
 * For each existing tenant-scoped model it:
 *   1. adds a `tenantId String` column (final NOT-NULL state; the expand-contract
 *      migration backfills legacy rows to 'au'),
 *   2. rescopes every field-level `@unique` → `@@unique([tenantId, <field>])`,
 *   3. prepends `tenantId` to every existing `@@unique(...)` / `@@index(...)`,
 *   4. reshapes the two named-field PKs: Role `@@id([tenantId, name])`,
 *      SlideGeneratorState `@@id([tenantId, scope])`,
 *   5. guarantees at least one tenantId-leading index.
 *
 * GLOBAL models and the 3 NEW tenant models (UserTenant/PendingAdminGrant/
 * AuditLog — authored by hand with tenantId already) are left untouched.
 *
 * Idempotent: skips any model that already has a `tenantId` field.
 * Verify after running with `prisma generate` (validates the result).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = resolve("prisma/schema.prisma");
const MAP = resolve("src/lib/tenant-models.ts");

// Models whose PK is a named field (not a separate `id`) — special reshape.
const PK_RESHAPE = {
  Role: { field: "name", id: "@@id([tenantId, name])" },
  SlideGeneratorState: { field: "scope", id: "@@id([tenantId, scope])" },
};
// New models authored by hand with tenantId already — never touch here.
const NEW_MODELS = new Set(["Tenant", "TenantSetting", "UserTenant", "PendingAdminGrant", "AuditLog"]);

// ── Read the tenant-scoped set from the map (single source of truth) ────────
function readTenantSet() {
  const src = readFileSync(MAP, "utf8");
  const block = src.split("TENANT_SCOPED_MODELS = new Set")[1].split("]);")[0];
  const names = [...block.matchAll(/"([A-Z][A-Za-z]+)"/g)].map((m) => m[1]);
  return new Set(names.filter((n) => !NEW_MODELS.has(n)));
}

const TENANT = readTenantSet();
const schema = readFileSync(SCHEMA, "utf8");
const lines = schema.split("\n");
const out = [];

let i = 0;
const touched = [];
while (i < lines.length) {
  const line = lines[i];
  const m = line.match(/^model (\w+) \{/);
  if (!m || !TENANT.has(m[1])) {
    out.push(line);
    i++;
    continue;
  }

  const modelName = m[1];
  // Gather the model body (until the closing brace at column 0).
  const body = [];
  let j = i + 1;
  while (j < lines.length && !/^\}/.test(lines[j])) {
    body.push(lines[j]);
    j++;
  }
  const closing = lines[j]; // the "}" line

  // Idempotency: already scoped?
  if (body.some((l) => /^\s*tenantId\s+String/.test(l))) {
    out.push(line, ...body, closing);
    i = j + 1;
    continue;
  }

  const reshape = PK_RESHAPE[modelName];
  const uniqueFields = [];
  const newBody = [];

  for (const raw of body) {
    let l = raw;

    // Reshape named-field PK: strip `@id` from the field (moved to @@id block).
    if (reshape) {
      const fieldRe = new RegExp(`^(\\s*${reshape.field}\\s+\\S+.*?)\\s*@id\\b(.*)$`);
      const fm = l.match(fieldRe);
      if (fm) l = `${fm[1]}${fm[2]}`.replace(/\s+$/, "");
    }

    // Rescope field-level @unique (single @, not @@unique) → collect + strip.
    const um = l.match(/^\s*(\w+)\s+\S+/);
    if (um && /(?<!@)@unique\b/.test(l)) {
      uniqueFields.push(um[1]);
      l = l.replace(/\s*(?<!@)@unique\b/, "");
    }

    // Prepend tenantId to existing block-level @@unique / @@index.
    l = l.replace(/@@unique\(\[(?!tenantId\b)/g, "@@unique([tenantId, ");
    l = l.replace(/@@index\(\[(?!tenantId\b)/g, "@@index([tenantId, ");

    newBody.push(l);
  }

  // Insert `tenantId String` immediately after the first PK / id field.
  const idIdx = newBody.findIndex((l) =>
    reshape ? new RegExp(`^\\s*${reshape.field}\\s`).test(l) : /^\s*id\s+String/.test(l),
  );
  const insertAt = idIdx >= 0 ? idIdx + 1 : 0;
  newBody.splice(insertAt, 0, "  tenantId String");

  // Build trailing attribute lines: @@id reshape, rescoped uniques, fallback index.
  const trailer = [];
  if (reshape) trailer.push(`  ${reshape.id}`);
  for (const f of uniqueFields) trailer.push(`  @@unique([tenantId, ${f}])`);

  const hasTenantIndex = newBody.some((l) => /@@(index|unique)\(\[tenantId\b/.test(l)) || trailer.length > 0;
  if (!hasTenantIndex) trailer.push("  @@index([tenantId])");
  else if (!newBody.some((l) => /@@index\(\[tenantId\b/.test(l)) && !trailer.some((l) => /@@index/.test(l))) {
    // Has a tenantId-leading @@unique (serves the prefix) — no extra index needed.
  }

  out.push(line, ...newBody, ...trailer, closing);
  touched.push(modelName);
  i = j + 1;
}

writeFileSync(SCHEMA, out.join("\n"));
console.log(`✅ scoped ${touched.length} models`);
console.log(touched.join(", "));
