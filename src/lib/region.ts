export type Region = "au" | "nz";

export interface TimezoneOption {
  value: string;
  label: string;
}

export interface RegionConfig {
  region: Region;
  countryName: string;
  lang: string;
  communityName: string;
  currency: string;
  currencySymbol: string;
  defaultTimezone: string;
  /** Region-specific GA4 measurement id (null disables analytics for the deploy). */
  gaId: string | null;
  /** Default sender for transactional + campaign email (overridable via RESEND_FROM_EMAIL). */
  fromEmail: string;
  /** Bare sender address for this region (e.g. "noreply@claudecommunity.com.au"). */
  senderEmail: string;
  /** Sending / public domain for this region (e.g. "claudecommunity.com.au"). */
  senderDomain: string;
  /** Timezone options shown in event/course editor dropdowns for this region. */
  timezoneOptions: TimezoneOption[];
  /** Demonym used attributively in copy, e.g. "the {nationality} Claude Code community". */
  nationality: string;
  /** Headline cities used in marketing copy / SEO keywords for this region. */
  majorCities: string[];
  /** Short brand label for nav/footer, e.g. "Claude Code NZ". */
  shortName: string;
  /** Public Discord invite used across all surfaces (marketing CTAs, navbar, community/app). */
  discordCommunityInvite: string;
  /** Region LinkedIn company page, or null when none exists yet (omitted from JSON-LD sameAs). */
  linkedinUrl: string | null;
  /** Canonical public site URL for this region (fallback when NEXT_PUBLIC_SITE_URL is unset). */
  siteUrl: string;
  /** App URL for this region (fallback when NEXT_PUBLIC_APP_URL is unset). */
  appUrl: string;
  /** Hero map illustration for the region. */
  mapImage: string;
  /** Default OpenGraph/Twitter share image for the region. */
  ogImage: string;
  /** Homepage "meetup moments" gallery images for the region. */
  galleryImages: { src: string; alt: string }[];
  /**
   * Size-claim qualifier used in marketing copy as
   * "{countryName}'s {communitySuperlative}Claude Code community".
   * Established regions can claim "largest "; new regions leave it empty
   * to avoid an unverifiable comparative. Note the trailing space.
   */
  communitySuperlative: string;
  /** Whether the merch store is live for this region (hides nav links + 404s /merch when false). */
  merchEnabled: boolean;
}

/** OpenGraph locale form ("en-NZ" -> "en_NZ") derived from the region lang. */
export function ogLocale(region: Region = REGION): string {
  return getRegionConfig(region).lang.replace("-", "_");
}

/** "Sydney, Melbourne, Brisbane and Perth" — the region's headline cities as prose. */
export function majorCitiesPhrase(opts: { region?: Region; conjunction?: string } = {}): string {
  const { region = REGION, conjunction = "and" } = opts;
  const cities = getRegionConfig(region).majorCities;
  if (cities.length <= 1) return cities.join("");
  return `${cities.slice(0, -1).join(", ")} ${conjunction} ${cities[cities.length - 1]}`;
}

// Build-time inlined (NEXT_PUBLIC_*). Defaults to "au" when unset so the
// existing AU deploy is unchanged.
export const REGION: Region = (process.env.NEXT_PUBLIC_REGION as Region | undefined) ?? "au";

export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  au: {
    region: "au",
    countryName: "Australia",
    lang: "en-AU",
    communityName: "Claude Code Community Australia",
    currency: "AUD",
    currencySymbol: "$",
    defaultTimezone: "Australia/Sydney",
    gaId: process.env.NEXT_PUBLIC_GA_ID ?? "G-WZ69MRR49S",
    fromEmail: "Claude Community Australia <noreply@claudecommunity.com.au>",
    senderEmail: "noreply@claudecommunity.com.au",
    senderDomain: "claudecommunity.com.au",
    timezoneOptions: [
      { value: "Australia/Sydney", label: "Sydney / Melbourne / Canberra (AEST/AEDT)" },
      { value: "Australia/Brisbane", label: "Brisbane / Gold Coast (AEST)" },
      { value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
      { value: "Australia/Perth", label: "Perth (AWST)" },
      { value: "Australia/Hobart", label: "Hobart (AEST/AEDT)" },
      { value: "Australia/Darwin", label: "Darwin (ACST)" },
      { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
    ],
    nationality: "Australian",
    majorCities: ["Sydney", "Melbourne", "Brisbane", "Perth"],
    shortName: "Claude Code AU",
    discordCommunityInvite: "https://discord.gg/h8GxQgQdrc",
    linkedinUrl: "https://www.linkedin.com/company/claude-code-community-australia",
    siteUrl: "https://claudecommunity.com.au",
    appUrl: "https://claudecommunity.com.au",
    mapImage: "/images/claude-community-map.svg",
    ogImage: "/images/og-image.png",
    galleryImages: [
      { src: "/images/melbourne-1.jpg", alt: "Claude Code Melbourne meetup" },
      { src: "/images/melbourne-2.jpg", alt: "Claude Code Melbourne event" },
      { src: "/images/melbourne-3.jpg", alt: "Claude Code Melbourne presentation" },
      { src: "/images/melbourne-4.png", alt: "Claude Code Melbourne group" },
      { src: "/images/melbourne-5.jpg", alt: "Claude Code Melbourne speaker" },
    ],
    communitySuperlative: "largest ",
    merchEnabled: true,
  },
  nz: {
    region: "nz",
    countryName: "New Zealand",
    lang: "en-NZ",
    communityName: "Claude Code Community New Zealand",
    currency: "NZD",
    currencySymbol: "$",
    defaultTimezone: "Pacific/Auckland",
    gaId: process.env.NEXT_PUBLIC_GA_ID ?? null,
    fromEmail: "Claude Code Community New Zealand <noreply@claudecommunity.co.nz>",
    senderEmail: "noreply@claudecommunity.co.nz",
    senderDomain: "claudecommunity.co.nz",
    timezoneOptions: [{ value: "Pacific/Auckland", label: "Auckland / Wellington (NZST/NZDT)" }],
    nationality: "New Zealand",
    majorCities: ["Auckland", "Wellington", "Christchurch"],
    shortName: "Claude Code NZ",
    discordCommunityInvite: "https://discord.gg/NmzuZSBXSw",
    linkedinUrl: null,
    siteUrl: "https://claudecommunity.co.nz",
    appUrl: "https://claudecommunity.co.nz",
    // Single shared placeholder for the hero map + OG card until real NZ
    // artwork is ready. No meetup gallery yet (empty -> section hidden).
    mapImage: "/images/nz-placeholder.png",
    ogImage: "/images/nz-placeholder.png",
    galleryImages: [],
    communitySuperlative: "",
    merchEnabled: false,
  },
};

export function getRegionConfig(region: Region = REGION): RegionConfig {
  return REGION_CONFIGS[region];
}

/**
 * Canonical site URL. Prefers the build/runtime-inlined NEXT_PUBLIC_SITE_URL
 * (which carries the exact host, e.g. staging vs prod), falling back to the
 * region's production URL — never a hardcoded AU literal.
 */
export function siteUrl(region: Region = REGION): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? getRegionConfig(region).siteUrl;
}

/** App URL, mirroring {@link siteUrl} but for NEXT_PUBLIC_APP_URL. */
export function appUrl(region: Region = REGION): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? getRegionConfig(region).appUrl;
}

/**
 * The region's public Discord invite (used across all surfaces: marketing CTAs,
 * navbar, community/app). Always resolve invites through this — never hardcode a
 * discord.gg link.
 */
export function discordCommunityInvite(region: Region = REGION): string {
  return getRegionConfig(region).discordCommunityInvite;
}
