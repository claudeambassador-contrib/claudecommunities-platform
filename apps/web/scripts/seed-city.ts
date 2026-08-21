/**
 * Seed a provisioned city D1 + REGISTRY memberships for local smoke / e2e.
 *
 * Usage:
 *   bun scripts/seed-city.ts [slug] [--email you@example.com] [--dry-run]
 *
 * Default slug is sydney. --email (or SEED_OWNER_EMAIL) creates an invite_
 * user that Clerk claims on first sign-in, with owner membership for that city.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildCitySeed } from "../src/modules/tenants/seed/citySeed";

const APP = resolve(import.meta.dirname, "..");

interface Args {
  dryRun: boolean;
  ownerEmail: string | null;
  slug: string;
}

interface TenantRow {
  d1_binding: string;
  org_id: string;
}

function parseArgs(argv: string[]): Args {
  let slug = "sydney";
  let ownerEmail = process.env.SEED_OWNER_EMAIL?.trim() || null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--email") {
      ownerEmail = argv[i + 1]?.trim() || null;
      i += 1;
      continue;
    }
    if (arg?.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
    if (arg) {
      slug = arg;
    }
  }
  return {
    dryRun,
    ownerEmail,
    slug: slug
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, ""),
  };
}

function parseTenantRow(raw: string): TenantRow {
  const parsed: unknown = JSON.parse(raw);
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  for (const batch of batches) {
    if (!batch || typeof batch !== "object") {
      continue;
    }
    const results = "results" in batch ? batch.results : null;
    if (!Array.isArray(results) || results.length === 0) {
      continue;
    }
    const [row] = results;
    if (
      row &&
      typeof row === "object" &&
      "org_id" in row &&
      "d1_binding" in row &&
      typeof row.org_id === "string" &&
      typeof row.d1_binding === "string"
    ) {
      return { d1_binding: row.d1_binding, org_id: row.org_id };
    }
  }
  throw new Error("City is not provisioned in local REGISTRY");
}

function lookupTenant(slug: string): TenantRow {
  const raw = execFileSync(
    "bunx",
    [
      "wrangler",
      "d1",
      "execute",
      "REGISTRY",
      "--local",
      "--config",
      "wrangler.jsonc",
      "--json",
      "--command",
      `SELECT org_id, d1_binding FROM tenants WHERE slug = '${slug.replaceAll("'", "''")}'`,
    ],
    { cwd: APP, encoding: "utf-8" },
  );
  try {
    return parseTenantRow(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}. Run: bun run db:provision:city -- ${slug} "${slug}" && bunx wrangler d1 execute REGISTRY --local --file=scripts/.provision-${slug}.sql`,
      { cause: error },
    );
  }
}

function applySql(binding: string, file: string): void {
  execFileSync(
    "bunx",
    ["wrangler", "d1", "execute", binding, "--local", "--config", "wrangler.jsonc", "--file", file],
    { cwd: APP, stdio: "inherit" },
  );
}

const args = parseArgs(process.argv.slice(2));
if (!args.slug) {
  console.error("Usage: bun scripts/seed-city.ts [slug] [--email you@example.com] [--dry-run]");
  process.exit(1);
}

const tenant = lookupTenant(args.slug);
const seed = buildCitySeed({
  now: Date.now(),
  orgId: tenant.org_id,
  ownerEmail: args.ownerEmail,
});

const tenantFile = resolve(APP, `scripts/.seed-${args.slug}-tenant.sql`);
const registryFile = resolve(APP, `scripts/.seed-${args.slug}-registry.sql`);
writeFileSync(tenantFile, seed.tenantSql);
writeFileSync(registryFile, seed.registrySql);

console.log(`Wrote ${tenantFile}`);
console.log(`Wrote ${registryFile}`);
console.log(`org_id=${tenant.org_id} binding=${tenant.d1_binding}`);
if (args.ownerEmail) {
  console.log(`Owner invite: sign in as ${args.ownerEmail} to claim city owner.`);
} else {
  console.log("No --email: public content is seeded; admin routes need a later owner grant.");
}

if (args.dryRun) {
  console.log("\n-- tenant SQL --\n", seed.tenantSql);
  console.log("\n-- registry SQL --\n", seed.registrySql);
  process.exit(0);
}

applySql(tenant.d1_binding, tenantFile);
applySql("REGISTRY", registryFile);
console.log(`Seeded ${args.slug}. Try http://localhost:3001/${args.slug}/events`);
