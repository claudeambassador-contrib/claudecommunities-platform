import { describe, expect, it } from "vitest";
import { parseTenantConfig, TENANT_CONFIG_DEFAULTS } from "@/lib/tenant-config";

describe("parseTenantConfig", () => {
  it("returns defaults for empty/invalid input", () => {
    expect(parseTenantConfig(null, null)).toEqual({ ...TENANT_CONFIG_DEFAULTS, gaId: null });
    expect(parseTenantConfig("not json", null).communityName).toBe(TENANT_CONFIG_DEFAULTS.communityName);
  });

  it("overlays stored values over defaults", () => {
    const cfg = parseTenantConfig(
      JSON.stringify({ communityName: "Acme", currency: "AUD", majorCities: ["Sydney"] }),
      null,
    );
    expect(cfg.communityName).toBe("Acme");
    expect(cfg.currency).toBe("AUD");
    expect(cfg.majorCities).toEqual(["Sydney"]);
    expect(cfg.lang).toBe(TENANT_CONFIG_DEFAULTS.lang); // untouched
  });

  it("the gaId column wins over the JSON blob", () => {
    expect(parseTenantConfig(JSON.stringify({ gaId: "G-INSIDE" }), "G-COLUMN").gaId).toBe("G-COLUMN");
    expect(parseTenantConfig(JSON.stringify({ gaId: "G-INSIDE" }), null).gaId).toBe("G-INSIDE");
  });
});
