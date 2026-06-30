/**
 * The two built-in single-tenant regions with hand-authored branding literals in
 * {@link REGION_CONFIGS}. These keep their exact, tested behaviour forever.
 */
export type KnownRegion = "au" | "nz";

/**
 * A deploy's region. `"au"`/`"nz"` are the known, literal-backed regions; any
 * other string is a self-host region whose branding comes from the DB
 * (`getTenantConfig()`) at runtime, with {@link getRegionConfig} synthesizing a
 * generic build-time config from `NEXT_PUBLIC_*` vars for the legacy metadata
 * call sites. The `(string & {})` arm keeps `"au"`/`"nz"` as autocomplete hints
 * while still accepting arbitrary self-host values.
 */
export type Region = KnownRegion | (string & {});

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
export const REGION: Region = process.env.NEXT_PUBLIC_REGION ?? "au";

// Only the two built-in regions carry hand-authored literals. A self-host region
// (any other NEXT_PUBLIC_REGION value) is NOT a key here — getRegionConfig()
// synthesizes a generic config for it from NEXT_PUBLIC_* (see below).
export const REGION_CONFIGS: Record<KnownRegion, RegionConfig> = {
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

/**
 * Build a generic {@link RegionConfig} for a self-host region (any region not in
 * {@link REGION_CONFIGS}) from `NEXT_PUBLIC_*` build vars, with safe defaults
 * that mirror `TENANT_CONFIG_DEFAULTS` in `src/lib/tenant-config.ts`. This keeps
 * the legacy build-time metadata call sites (manifest, robots, sitemap,
 * security.txt, og locale) working — never `undefined`, never a throw — for a
 * community that brands itself without editing this shared source. The DB
 * (`getTenantConfig()`) remains the runtime source of truth; this only feeds the
 * handful of build-baked metadata routes.
 *
 * Defaults are inlined (not imported) so this module stays free of the React /
 * Prisma deps that `tenant-config.ts` pulls in — it runs in middleware/edge.
 */
function genericRegionConfig(region: Region): RegionConfig {
  const env = process.env;
  const communityName = env.NEXT_PUBLIC_COMMUNITY_NAME ?? "Claude Community";
  const senderDomain = env.NEXT_PUBLIC_SENDER_DOMAIN ?? "claudecommunities.com";
  const resolvedSiteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://claudecommunities.com";
  return {
    region,
    countryName: env.NEXT_PUBLIC_COUNTRY ?? "",
    lang: env.NEXT_PUBLIC_LANG ?? "en",
    communityName,
    currency: env.NEXT_PUBLIC_CURRENCY ?? "USD",
    currencySymbol: env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "$",
    defaultTimezone: env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "UTC",
    gaId: env.NEXT_PUBLIC_GA_ID ?? null,
    fromEmail: env.NEXT_PUBLIC_FROM_EMAIL ?? `${communityName} <noreply@${senderDomain}>`,
    senderEmail: `noreply@${senderDomain}`,
    senderDomain,
    timezoneOptions: [],
    nationality: env.NEXT_PUBLIC_NATIONALITY ?? "",
    majorCities: [],
    shortName: env.NEXT_PUBLIC_SHORT_NAME ?? communityName,
    discordCommunityInvite: env.NEXT_PUBLIC_DISCORD_INVITE ?? "",
    linkedinUrl: null,
    siteUrl: resolvedSiteUrl,
    appUrl: env.NEXT_PUBLIC_APP_URL ?? resolvedSiteUrl,
    mapImage: "/images/claude-community-map.svg",
    ogImage: "/images/og-image.png",
    galleryImages: [],
    communitySuperlative: "",
    merchEnabled: false,
  };
}

/**
 * Resolve a region's build-time config. `"au"`/`"nz"` return their exact,
 * tested literals from {@link REGION_CONFIGS}; any other (self-host) region gets
 * a generic config synthesized from `NEXT_PUBLIC_*` (see {@link
 * genericRegionConfig}) so the legacy metadata routes never break.
 */
export function getRegionConfig(region: Region = REGION): RegionConfig {
  const known = (REGION_CONFIGS as Record<string, RegionConfig | undefined>)[region];
  return known ?? genericRegionConfig(region);
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
