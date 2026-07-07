/**
 * Seed a tenant's registry row (`Tenant`) and config row (`TenantSetting`) from
 * the build-baked `REGION_CONFIGS`. This is the bridge that turns the legacy
 * per-region branding into the per-tenant `TenantSetting.config` blob that
 * `getTenantConfig()` reads at runtime (`src/lib/tenant-config.ts`).
 *
 * WHY THIS EXISTS: migration 0021 creates the `Tenant`/`TenantSetting` tables
 * and backfills `tenantId='au'` onto every scoped row, but seeds NO `Tenant` or
 * `TenantSetting` row. Without a `TenantSetting` row, `getTenantConfig()` finds
 * nothing and falls back to the GENERIC `TENANT_CONFIG_DEFAULTS` ("Claude
 * Community", USD, claudecommunities.com) — so the live AU site would render
 * placeholder branding while every isolation gate stays green. This seed closes
 * that gap.
 *
 * GENERATED, NOT HAND-TYPED: `parseTenantConfig` silently swallows a malformed
 * config JSON back to defaults, so a single transcription typo in a hand-written
 * SQL blob would reproduce the exact green-gates/placeholder-site failure. We
 * therefore derive the JSON programmatically from `REGION_CONFIGS` and lock the
 * round-trip with `test/iso/tenant-seed.test.ts`.
 *
 * REGION-AWARE: a static `.sql` migration can't read the deploy region
 * (`NEXT_PUBLIC_REGION` is build-time, invisible to `wrangler d1 migrations
 * apply`) and the same `migrations/` chain is applied to BOTH the AU DB and the
 * (not-yet-live) NZ DB. So this is a region-keyed seed, run per-deploy, not a
 * migration: au → au's DB, nz → nz's DB.
 *
 * Usage (prints idempotent SQL to stdout):
 *   tsx scripts/seed-tenant.ts [au|nz]      # default: au
 * Wired through npm (see package.json `*:d1:seed-tenant`), which pipes the SQL
 * into `wrangler d1 execute`.
 */
import { SEED_CITIES } from "../src/lib/cities";
import type { Block } from "../src/lib/cms/blocks";
import { AU_WEBINAR_BLOCK, DEFAULT_HOME_SECTIONS } from "../src/lib/cms/defaults";
import { type KnownRegion, REGION_CONFIGS, type Region, type RegionConfig } from "../src/lib/region";
import { AU_SEED_RESOURCES, type VideoResource } from "../src/lib/resources";
import type { TenantConfig } from "../src/lib/tenant-config";

/** A tenant seed: the registry row, the broken-out gaId column, and the config JSON. */
export interface TenantSeed {
  /** Tenant slug — IS the tenantId everywhere downstream. */
  slug: Region;
  /**
   * The public host this tenant is reached on (e.g. `claudecommunity.com.au`).
   * Load-bearing: `claudecommunity.com.au` is NOT in `PLATFORM_HOSTS`, so the
   * live site flows through middleware's custom-domain branch
   * (`resolveTenantByDomain` → `Tenant.customDomain`). If this is NULL the lookup
   * misses → the whole site 404s. Derived from the region's `siteUrl` host.
   */
  customDomain: string;
  /** Display name for the `Tenant` registry row. */
  name: string;
  /** Broken-out GA4 id column (wins over any value inside the JSON blob). */
  gaId: string | null;
  /** Sender columns mirrored onto `TenantSetting` (config JSON stays authoritative). */
  fromEmail: string;
  senderDomain: string;
  /** The `TenantConfig` object stored as `TenantSetting.config` JSON. */
  config: TenantConfig;
}

/**
 * Map a legacy `RegionConfig` onto the runtime `TenantConfig` shape. Pure.
 * Drops `region` (not part of `TenantConfig`) and lifts `gaId` out to the
 * broken-out column — everything else is carried over verbatim so the round-trip
 * `parseTenantConfig(JSON.stringify(config), gaId)` reproduces the region's
 * branding exactly.
 */
export function regionToTenantSeed(rc: RegionConfig): TenantSeed {
  const { region, gaId, ...rest } = rc;
  return {
    slug: region,
    customDomain: new URL(rc.siteUrl).host,
    name: rc.communityName,
    gaId: gaId ?? null,
    fromEmail: rc.fromEmail,
    senderDomain: rc.senderDomain,
    // `gaId` lives in its own column, not the JSON. Everything else is config.
    config: { ...rest, gaId: null } as TenantConfig,
  };
}

/** Escape a JS string for a single-quoted SQLite literal. */
function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Escape an optional string column (NULL when absent). */
function sqlNullable(value: string | null): string {
  return value === null ? "NULL" : sqlStr(value);
}

/**
 * Idempotent (`INSERT OR IGNORE`) SQL seeding the `Tenant` + `TenantSetting`
 * rows for a region. Insert-once on purpose: once seeded, `TenantSetting.config`
 * becomes admin-editable, so a re-run must NOT clobber it. To re-seed, delete the
 * row first.
 */
export function buildTenantSeedSql(region: KnownRegion): string {
  const rc = REGION_CONFIGS[region];
  if (!rc) throw new Error(`Unknown region "${region}" — expected one of: ${Object.keys(REGION_CONFIGS).join(", ")}`);
  const seed = regionToTenantSeed(rc);
  const configJson = JSON.stringify(seed.config);

  return [
    `-- Tenant + TenantSetting seed for "${seed.slug}" (generated from REGION_CONFIGS by scripts/seed-tenant.ts).`,
    `-- Idempotent: INSERT OR IGNORE never clobbers an existing (admin-editable) config row.`,
    `INSERT OR IGNORE INTO "Tenant" ("id", "slug", "customDomain", "name", "status", "createdAt", "updatedAt")`,
    `VALUES (${sqlStr(seed.slug)}, ${sqlStr(seed.slug)}, ${sqlStr(seed.customDomain)}, ${sqlStr(seed.name)}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    ``,
    `INSERT OR IGNORE INTO "TenantSetting" ("id", "tenantId", "config", "gaId", "fromEmail", "senderDomain", "createdAt", "updatedAt")`,
    `VALUES (${sqlStr(seed.slug)}, ${sqlStr(seed.slug)}, ${sqlStr(configJson)}, ${sqlNullable(seed.gaId)}, ${sqlStr(seed.fromEmail)}, ${sqlStr(seed.senderDomain)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    ``,
  ].join("\n");
}

/**
 * The home-page block array for a region. Starts from the generic
 * `DEFAULT_HOME_SECTIONS` (webinar disabled) and, for AU only, swaps in the
 * enabled `AU_WEBINAR_BLOCK` so AU reproduces today's enabled webinar bar. NZ
 * keeps the default disabled webinar. No `REGION === "au"` check leaks into the
 * renderer — visibility is purely the seeded `enabled` flag.
 */
function homeBlocksForRegion(region: KnownRegion): Block[] {
  return DEFAULT_HOME_SECTIONS.map((block) =>
    block.type === "webinar" && region === "au" ? AU_WEBINAR_BLOCK : block,
  );
}

/**
 * Idempotent (`INSERT OR IGNORE`) SQL seeding the `home` `Page` row for a
 * region. Insert-once on purpose: once seeded, `sections` becomes admin-editable
 * via the Home Page CMS, so a re-run must NOT clobber it. The id is deterministic
 * (`home-<slug>`) so re-runs target the same row. AU's webinar bar ships enabled;
 * NZ's disabled (both via the same default block shape).
 */
export function buildPageSeedSql(region: KnownRegion): string {
  if (!REGION_CONFIGS[region]) {
    throw new Error(
      `Unknown region "${region}" — expected one of: ${Object.keys(REGION_CONFIGS).join(", ")}`,
    );
  }
  const sections = JSON.stringify({ blocks: homeBlocksForRegion(region) });

  return [
    `-- home Page (Home Page CMS) seed for "${region}" (generated by scripts/seed-tenant.ts).`,
    `-- Idempotent: INSERT OR IGNORE never clobbers an existing (admin-editable) sections row.`,
    `INSERT OR IGNORE INTO "Page" ("id", "tenantId", "key", "title", "sections", "createdAt", "updatedAt")`,
    `VALUES (${sqlStr(`home-${region}`)}, ${sqlStr(region)}, 'home', NULL, ${sqlStr(sections)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    ``,
  ].join("\n");
}

/**
 * Idempotent (`INSERT OR IGNORE`) SQL seeding the `City` rows for a region from
 * `SEED_CITIES` (the legacy `ALL_CITIES`). Insert-once on purpose: once seeded,
 * cities become admin-editable, so a re-run must NOT clobber edits. The id is
 * deterministic (`city-<region>-<slug>`) so re-runs target the same row.
 * `keywords` is stored as a JSON string; `isCapital` as a 0/1 integer (SQLite
 * has no Boolean type); `position` is the index within the region-filtered list.
 */
export function buildCitySeedSql(region: KnownRegion): string {
  if (!REGION_CONFIGS[region]) {
    throw new Error(
      `Unknown region "${region}" — expected one of: ${Object.keys(REGION_CONFIGS).join(", ")}`,
    );
  }
  const cities = SEED_CITIES.filter((c) => c.region === region);

  const lines = [
    `-- City catalog seed for "${region}" (generated from SEED_CITIES by scripts/seed-tenant.ts).`,
    `-- Idempotent: INSERT OR IGNORE never clobbers an existing (admin-editable) city row.`,
  ];
  cities.forEach((city, index) => {
    const id = `city-${region}-${city.slug}`;
    const keywords = JSON.stringify(city.keywords);
    lines.push(
      `INSERT OR IGNORE INTO "City" ("id", "tenantId", "slug", "name", "state", "stateFull", "description", "isCapital", "keywords", "timezone", "position", "createdAt", "updatedAt")`,
      `VALUES (${sqlStr(id)}, ${sqlStr(region)}, ${sqlStr(city.slug)}, ${sqlStr(city.name)}, ${sqlStr(city.state)}, ${sqlStr(city.stateFull)}, ${sqlStr(city.description)}, ${city.isCapital ? 1 : 0}, ${sqlStr(keywords)}, ${sqlStr(city.timezone)}, ${index}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
  });
  lines.push("");
  return lines.join("\n");
}

/** Seed resources for a region: AU ships its curated videos; new regions none. */
function seedResourcesForRegion(region: KnownRegion): VideoResource[] {
  return region === "au" ? AU_SEED_RESOURCES : [];
}

/**
 * Idempotent (`INSERT OR IGNORE`) SQL seeding the `Resource` rows for a region.
 * Each row breaks out slug/publishedAt/order for querying and stores the rest of
 * the VideoResource as the JSON `data` blob the service parses. Insert-once: once
 * seeded, resources are admin-editable, so a re-run must NOT clobber edits. The id
 * is deterministic (`resource-<region>-<slug>`) so re-runs target the same row.
 */
export function buildResourceSeedSql(region: KnownRegion): string {
  const resources = seedResourcesForRegion(region);
  if (resources.length === 0) {
    return `-- No seed resources for "${region}".\n`;
  }
  const lines = [
    `-- Resource seed for "${region}" (generated from AU_SEED_RESOURCES by scripts/seed-tenant.ts).`,
    `-- Idempotent: INSERT OR IGNORE never clobbers an admin-edited resource row.`,
  ];
  resources.forEach((resource, index) => {
    const { slug, publishedAt, ...doc } = resource;
    const id = `resource-${region}-${slug}`;
    const data = JSON.stringify(doc);
    lines.push(
      `INSERT OR IGNORE INTO "Resource" ("id", "tenantId", "slug", "publishedAt", "order", "isPublished", "data", "createdAt", "updatedAt")`,
      `VALUES (${sqlStr(id)}, ${sqlStr(region)}, ${sqlStr(slug)}, ${sqlStr(publishedAt)}, ${index}, 1, ${sqlStr(data)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
  });
  lines.push("");
  return lines.join("\n");
}

// CLI entry: `tsx scripts/seed-tenant.ts [au|nz]` -> SQL on stdout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const region = (process.argv[2] ?? "au") as KnownRegion;
  process.stdout.write(buildTenantSeedSql(region));
  process.stdout.write(buildPageSeedSql(region));
  process.stdout.write(buildCitySeedSql(region));
  process.stdout.write(buildResourceSeedSql(region));
}
