/**
 * Seed the PLATFORM home tenant + a super_admin you can log in as — the
 * bootstrap that makes a fresh `staging.claudecommunities.com` usable WITHOUT
 * the manual `wrangler d1 execute "UPDATE User SET role='super_admin'"` dance
 * (`docs/multi-tenancy-setup.md` §4).
 *
 * The home tenant (`HOME_TENANT`, default `platform`) is the tenant the apex and
 * `/admin` resolve to (see `src/lib/tenant-resolve.ts` rule 7). Its config stays
 * `{}` → `getTenantConfig()` falls back to the generic `TENANT_CONFIG_DEFAULTS`
 * (Claude Community / claudecommunities.com), which is exactly what we want for a
 * platform apex that isn't a real community.
 *
 * THE GATE/SEED CONTRACT: the Tenants configurator is gated on the GLOBAL
 * `User.role === "super_admin"` (a platform power, not a per-tenant permission).
 * `buildProvisionSql` only grants a super_admin *membership* (global role stays
 * "member"), so this seed adds the missing `UPDATE … role='super_admin'` to keep
 * the gate and the seed in agreement — otherwise you'd sign up and hit a 403.
 *
 * Usage (prints idempotent SQL to stdout; npm pipes it into wrangler):
 *   tsx scripts/seed-platform.ts <ownerEmail> [slug] [name]
 * Then sign up with <ownerEmail> to claim the super_admin account.
 */
import { buildProvisionSql } from "./provision-tenant";

/** Escape a JS string for a single-quoted SQLite literal. */
function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildPlatformSeedSql(args: {
  ownerEmail: string;
  slug?: string;
  name?: string;
}): string {
  const slug = (args.slug ?? "platform").toLowerCase();
  const name = args.name ?? "Claude Community";
  const email = args.ownerEmail.toLowerCase().trim();

  // buildProvisionSql already emits the home tenant's default Spaces +
  // LeaderboardLevels (via buildReferenceSeedSql) — tenant-scoped, replacing the
  // legacy (0021-broken) scripts/seed.sql for the platform deploy.
  return [
    buildProvisionSql({ slug, name, ownerEmail: email }),
    `-- Promote the owner to GLOBAL super_admin so the Tenants configurator gate`,
    `-- (User.role) agrees with the seeded super_admin membership.`,
    `UPDATE "User" SET "role" = 'super_admin' WHERE "email" = ${sqlStr(email)};`,
    ``,
  ].join("\n");
}

// CLI: `tsx scripts/seed-platform.ts <ownerEmail> [slug] [name]` -> SQL on stdout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [ownerEmail, slug, name] = process.argv.slice(2);
  if (!ownerEmail || !ownerEmail.includes("@")) {
    process.stderr.write(
      "Usage: tsx scripts/seed-platform.ts <ownerEmail> [slug] [name]\n" +
        "  e.g. tsx scripts/seed-platform.ts you@example.com\n",
    );
    process.exit(1);
  }
  process.stdout.write(buildPlatformSeedSql({ ownerEmail, slug, name }));
}
