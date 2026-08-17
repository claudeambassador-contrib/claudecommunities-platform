/**
 * Region is a *deploy* knob (AU vs NZ branding/secrets), not tenant isolation.
 * Cities (sydney, auckland, …) are tenants with their own D1.
 */
export type Region = "au" | "nz";

export type RegionConfig = {
  region: Region;
  countryName: string;
  currency: string;
  majorCitiesPhrase: string;
  siteName: string;
};

const CONFIGS: Record<Region, RegionConfig> = {
  au: {
    region: "au",
    countryName: "Australia",
    currency: "AUD",
    majorCitiesPhrase: "Sydney, Melbourne, Brisbane, and beyond",
    siteName: "Claude Community Australia",
  },
  nz: {
    region: "nz",
    countryName: "New Zealand",
    currency: "NZD",
    majorCitiesPhrase: "Auckland, Wellington, Christchurch, and beyond",
    siteName: "Claude Community New Zealand",
  },
};

export function getRegion(): Region {
  const raw =
    (typeof process !== "undefined" && process.env.VITE_REGION) ||
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: { VITE_REGION?: string } }).env?.VITE_REGION) ||
    "au";
  return raw === "nz" ? "nz" : "au";
}

export function getRegionConfig(region: Region = getRegion()): RegionConfig {
  return CONFIGS[region];
}
