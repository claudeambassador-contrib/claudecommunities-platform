import { describe, expect, it } from "vitest";
import { buildTenantSeedSql, regionToTenantSeed } from "../../scripts/seed-tenant";
import { REGION_CONFIGS } from "@/lib/region";
import { parseTenantConfig, TENANT_CONFIG_DEFAULTS } from "@/lib/tenant-config";

// THE SEED ROUND-TRIP GUARD. The bug this locks out: migration 0021 created the
// TenantSetting table but seeded no row, so getTenantConfig() fell through to the
// generic TENANT_CONFIG_DEFAULTS and the live AU site rendered placeholder
// branding ("Claude Community", USD) while every isolation gate stayed green.
// The fix seeds TenantSetting.config from REGION_CONFIGS; this test proves that
// what scripts/seed-tenant.ts emits, read back the way getTenantConfig() reads
// it (parseTenantConfig over the config JSON + gaId column), reproduces the
// region's real branding and is NOT the defaults.
describe("tenant seed round-trips to real branding (not placeholder defaults)", () => {
  for (const region of ["au", "nz"] as const) {
    describe(region, () => {
      const rc = REGION_CONFIGS[region];
      const seed = regionToTenantSeed(rc);
      // How getTenantConfig() resolves it: parse the stored JSON + broken-out gaId.
      const resolved = parseTenantConfig(JSON.stringify(seed.config), seed.gaId);

      it("reconstructs the region config exactly (minus the dropped `region` key)", () => {
        const { region: _dropped, ...expected } = rc;
        // Footer links are platform-wide defaults, not region branding, so they
        // are absent from RegionConfig and resolve from TENANT_CONFIG_DEFAULTS
        // on read-back (the seed carries no region-specific footers).
        expect(resolved).toEqual({
          ...expected,
          footerIndustries: TENANT_CONFIG_DEFAULTS.footerIndustries,
          footerResources: TENANT_CONFIG_DEFAULTS.footerResources,
        });
      });

      it("does NOT fall back to placeholder defaults", () => {
        expect(resolved.communityName).toBe(rc.communityName);
        expect(resolved.communityName).not.toBe(TENANT_CONFIG_DEFAULTS.communityName);
        expect(resolved.siteUrl).toBe(rc.siteUrl);
        expect(resolved.siteUrl).not.toBe(TENANT_CONFIG_DEFAULTS.siteUrl);
        expect(resolved.currency).toBe(rc.currency);
      });

      it("keeps gaId in the broken-out column, never inside the config JSON", () => {
        expect(seed.config.gaId).toBeNull();
        expect(seed.gaId).toBe(rc.gaId);
        expect(resolved.gaId).toBe(rc.gaId);
      });

      it("strips the non-TenantConfig `region` key from the stored JSON", () => {
        expect("region" in seed.config).toBe(false);
        expect(seed.config).not.toHaveProperty("region");
      });

      it("emits idempotent, self-FK-safe SQL (Tenant before TenantSetting)", () => {
        const sql = buildTenantSeedSql(region);
        const tenantAt = sql.indexOf('INSERT OR IGNORE INTO "Tenant"');
        const settingAt = sql.indexOf('INSERT OR IGNORE INTO "TenantSetting"');
        expect(tenantAt).toBeGreaterThanOrEqual(0); // idempotent insert
        expect(settingAt).toBeGreaterThan(tenantAt); // Tenant first (TenantSetting FKs Tenant.slug)
        expect(sql).toContain(rc.communityName);
        // gaId belongs in its column, not the embedded JSON blob.
        expect(sql).not.toContain('"region":');
      });

      it("seeds customDomain = the region's site host (NOT NULL — the 404 guard)", () => {
        // claudecommunity.com.au is NOT a PLATFORM_HOST, so the live site resolves
        // via Tenant.customDomain. A NULL here → resolveTenantByDomain miss → 404.
        const host = new URL(rc.siteUrl).host;
        expect(seed.customDomain).toBe(host);
        // Target the Tenant VALUES row specifically (only it carries status 'active').
        const tenantValues = buildTenantSeedSql(region)
          .split("\n")
          .find((l) => l.startsWith("VALUES (") && l.includes("'active'"));
        expect(tenantValues).toContain(`'${host}'`);
        expect(tenantValues).not.toContain("NULL");
      });
    });
  }

  it("au carries its GA id; nz has none yet", () => {
    expect(regionToTenantSeed(REGION_CONFIGS.au).gaId).toBe(REGION_CONFIGS.au.gaId);
    expect(regionToTenantSeed(REGION_CONFIGS.nz).gaId).toBeNull();
  });

  it("rejects an unknown region", () => {
    // @ts-expect-error — exercising the runtime guard with a bad slug.
    expect(() => buildTenantSeedSql("xx")).toThrow(/Unknown region/);
  });
});
