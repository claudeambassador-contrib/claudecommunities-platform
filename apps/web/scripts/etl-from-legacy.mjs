#!/usr/bin/env node
/**
 * Optional Phase-5 ETL stub: extract tenant-scoped rows from the legacy shared
 * D1 into a per-city D1. Not run automatically — requires explicit flags.
 *
 * Usage:
 *   bun apps/web/scripts/etl-from-legacy.mjs --tenant sydney --dry-run
 */
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (a.startsWith("--")) {
      return [[a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]];
    }
    return [];
  }),
);

const { tenant } = args;
if (!tenant || tenant === true) {
  console.error("Required: --tenant <slug>");
  process.exit(1);
}

console.log(`ETL stub for tenant=${tenant}`);
console.log(`dry-run=${Boolean(args["dry-run"])}`);
console.log(`
Implement per-table SELECT ... WHERE tenantId = ? against the legacy D1,
then INSERT into the city D1 with org_id from REGISTRY.tenants.

Suggested order: events → agenda/rsvps → spaces/posts → courses → talks → pages.
Skip empty-string tenantId defaults and Stripe columns unless billing is live.
`);
