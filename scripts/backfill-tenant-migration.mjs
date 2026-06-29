/**
 * One-shot post-processor for the tenant-isolation migration. Prisma's SQLite
 * table-rebuild copies existing rows with `INSERT INTO new_X (cols) SELECT cols
 * FROM X` — but the new `tenantId TEXT NOT NULL` column isn't in `cols`, so the
 * copy would fail NOT NULL on the live AU data. This injects `'au'` as the
 * tenantId for every copied row (the existing rows are all AU's), keeping the
 * final column default-FREE so a missing injection still fails loudly later.
 *
 * Usage: node scripts/backfill-tenant-migration.mjs migrations/0021_tenant_isolation.sql
 */
import { readFileSync, writeFileSync } from "node:fs";

const BACKFILL_TENANT = "au"; // existing rows belong to the AU community

const file = process.argv[2];
if (!file) {
  console.error("usage: backfill-tenant-migration.mjs <migration.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

// Tables whose rebuilt definition has a NOT NULL tenantId column.
const tenantTables = new Set();
for (const m of sql.matchAll(/CREATE TABLE "new_(\w+)" \(([\s\S]*?)\n\);/g)) {
  if (/"tenantId" TEXT NOT NULL/.test(m[2])) tenantTables.add(m[1]);
}

let patched = 0;
const out = sql.replace(
  /INSERT INTO "new_(\w+)" \(([^)]*)\) SELECT ([^;]*?) FROM "\1";/g,
  (full, table, cols, sel) => {
    if (!tenantTables.has(table)) return full;
    if (/"tenantId"/.test(cols)) return full; // already handled
    patched++;
    return `INSERT INTO "new_${table}" ("tenantId", ${cols}) SELECT '${BACKFILL_TENANT}', ${sel} FROM "${table}";`;
  },
);

writeFileSync(file, out);
console.log(`✅ backfilled tenantId='${BACKFILL_TENANT}' into ${patched} copy statements`);
console.log(`   tenant tables rebuilt: ${tenantTables.size}`);
