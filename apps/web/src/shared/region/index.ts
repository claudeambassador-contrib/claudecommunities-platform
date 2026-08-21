/**
 * Region is a *deploy* knob (AU vs NZ branding/secrets), not tenant isolation.
 * Cities (sydney, auckland, …) are tenants with their own D1.
 */
export type Region = "au" | "nz";

export interface RegionGalleryImage {
  alt: string;
  src: string;
}

export interface RegionConfig {
  communitySuperlative: string;
  countryName: string;
  currency: string;
  discordInvite: string;
  galleryImages: RegionGalleryImage[];
  majorCitiesPhrase: string;
  merchEnabled: boolean;
  region: Region;
  senderDomain: string;
  siteName: string;
}

const CONFIGS: Record<Region, RegionConfig> = {
  au: {
    communitySuperlative: "largest ",
    countryName: "Australia",
    currency: "AUD",
    discordInvite: "https://discord.gg/h8GxQgQdrc",
    galleryImages: [],
    majorCitiesPhrase: "Sydney, Melbourne, Brisbane, and beyond",
    merchEnabled: true,
    region: "au",
    senderDomain: "claudecommunity.com.au",
    siteName: "Claude Community Australia",
  },
  nz: {
    communitySuperlative: "",
    countryName: "New Zealand",
    currency: "NZD",
    discordInvite: "https://discord.gg/NmzuZSBXSw",
    galleryImages: [],
    majorCitiesPhrase: "Auckland, Wellington, Christchurch, and beyond",
    merchEnabled: false,
    region: "nz",
    senderDomain: "claudecommunity.co.nz",
    siteName: "Claude Community New Zealand",
  },
};

export function getRegion(): Region {
  const raw =
    (typeof process !== "undefined" && process.env.VITE_REGION) ||
    (import.meta !== undefined &&
      (import.meta as ImportMeta & { env?: { VITE_REGION?: string } }).env?.VITE_REGION) ||
    "au";
  return raw === "nz" ? "nz" : "au";
}

export function getRegionConfig(region: Region = getRegion()): RegionConfig {
  return CONFIGS[region];
}
