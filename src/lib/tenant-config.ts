/**
 * Per-tenant configuration — the runtime replacement for the build-baked
 * `REGION_CONFIGS` in `src/lib/region.ts` (`docs/multi-tenancy-isolation-spec.md`
 * §3 #32). Each tenant's branding/locale/email/analytics config is stored as a
 * JSON blob on `TenantSetting.config` and read per-request.
 *
 * `getTenantConfig()` is async (a DB read) and request-memoized via React
 * `cache()`. The pure `parseTenantConfig()` merges stored values over defaults
 * and is unit-tested. The region→config migration (108 files) swaps
 * `getRegionConfig()` call sites to `await getTenantConfig()`.
 */
import { cache } from "react";
import { getPlatformPrisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant-context";

export interface TimezoneOption {
  value: string;
  label: string;
}

/** A single editable footer link (Industries / Resources columns). */
export interface FooterLink {
  label: string;
  href: string;
}

/** A "stat" tile on the professionals / vibe-coders landing pages, e.g.
 * `{ value: "500+", label: "Developers in the community" }`. Per-tenant and
 * empty by default — a new community shows no unsourced figures until it sets
 * real ones. */
export interface LandingStat {
  value: string;
  label: string;
}

/** A tenant's resolved configuration (mirrors the former RegionConfig shape). */
export interface TenantConfig {
  countryName: string;
  lang: string;
  communityName: string;
  currency: string;
  currencySymbol: string;
  defaultTimezone: string;
  /** GA4 measurement id, or null to disable analytics for this tenant. */
  gaId: string | null;
  fromEmail: string;
  senderEmail: string;
  senderDomain: string;
  timezoneOptions: TimezoneOption[];
  nationality: string;
  majorCities: string[];
  shortName: string;
  discordCommunityInvite: string;
  linkedinUrl: string | null;
  siteUrl: string;
  appUrl: string;
  mapImage: string;
  ogImage: string;
  galleryImages: { src: string; alt: string }[];
  communitySuperlative: string;
  merchEnabled: boolean;
  /** Stat tiles on the `/professionals` landing page. Empty → the block is hidden. */
  professionalStats: LandingStat[];
  /** Stat tiles on the `/vibe-coders` landing page. Empty → the block is hidden. */
  vibeCoderStats: LandingStat[];
  /** Heading on the Discord promo card. Communities pick their own noun
   * ("…between meetups" vs "…between webinars"). */
  discordHeading: string;
  /** Footer "Industries" column links. Empty href falls back to nothing. */
  footerIndustries: FooterLink[];
  /** Footer "Resources" column links. An empty href falls back to the Discord invite. */
  footerResources: FooterLink[];
}

/** Safe defaults for a brand-new community (overridden by stored config). */
export const TENANT_CONFIG_DEFAULTS: TenantConfig = {
  countryName: "",
  lang: "en",
  communityName: "Claude Community",
  currency: "USD",
  currencySymbol: "$",
  defaultTimezone: "UTC",
  gaId: null,
  fromEmail: "Claude Community <noreply@claudecommunities.com>",
  senderEmail: "noreply@claudecommunities.com",
  senderDomain: "claudecommunities.com",
  timezoneOptions: [],
  nationality: "",
  majorCities: [],
  shortName: "Claude Community",
  discordCommunityInvite: "",
  linkedinUrl: null,
  siteUrl: "https://claudecommunities.com",
  appUrl: "https://claudecommunities.com",
  mapImage: "/images/claude-community-map.svg",
  ogImage: "/images/og-image.png",
  galleryImages: [],
  communitySuperlative: "",
  merchEnabled: false,
  professionalStats: [],
  vibeCoderStats: [],
  discordHeading: "Join the conversation between meetups",
  footerIndustries: [
    { label: "E-Commerce", href: "/for/ecommerce" },
    { label: "Marketing", href: "/for/marketing" },
    { label: "SaaS", href: "/for/saas" },
    { label: "Real Estate", href: "/for/real-estate" },
  ],
  footerResources: [
    { label: "Claude Code", href: "https://claude.ai/claude-code" },
    { label: "Documentation", href: "https://docs.anthropic.com" },
    { label: "Anthropic", href: "https://anthropic.com" },
    // Empty href → Footer falls back to the per-tenant Discord invite.
    { label: "Community Chat", href: "" },
  ],
};

/**
 * Merge a stored config JSON (and the broken-out gaId column) over the defaults.
 * Pure — unit-tested. Unknown/missing keys fall back to the default; the
 * `gaId` column wins over any value inside the JSON blob.
 */
export function parseTenantConfig(
  raw: string | null | undefined,
  gaId: string | null | undefined,
): TenantConfig {
  let stored: Partial<TenantConfig> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") stored = parsed as Partial<TenantConfig>;
    } catch {
      stored = {};
    }
  }
  return { ...TENANT_CONFIG_DEFAULTS, ...stored, gaId: gaId ?? stored.gaId ?? null };
}

/**
 * The current tenant's config. Request-memoized. Reads the registry/config plane
 * via the unscoped platform client (TenantSetting is a global registry model).
 */
export const getTenantConfig = cache(async (): Promise<TenantConfig> => {
  const tenantId = await getTenantId();
  const db = await getPlatformPrisma();
  const setting = await db.tenantSetting.findUnique({ where: { tenantId } });
  return parseTenantConfig(setting?.config, setting?.gaId ?? null);
});

// ── Server helpers — async successors to region.ts's sync helpers ────────────
// Client components read these fields off `useTenantConfig()` (see
// `@/components/TenantConfigProvider`); the pure formatters below work on both
// sides.

/** OpenGraph locale form ("en-NZ" -> "en_NZ"). Pure — usable client-side too. */
export function formatOgLocale(lang: string): string {
  return lang.replace("-", "_");
}

/** "Sydney, Melbourne, Brisbane and Perth" — cities as prose. Pure. */
export function formatCitiesPhrase(cities: string[], conjunction = "and"): string {
  if (cities.length <= 1) return cities.join("");
  return `${cities.slice(0, -1).join(", ")} ${conjunction} ${cities[cities.length - 1]}`;
}

/** OpenGraph locale for the current tenant (server). */
export async function ogLocale(): Promise<string> {
  return formatOgLocale((await getTenantConfig()).lang);
}

/** The current tenant's headline cities as prose (server). */
export async function majorCitiesPhrase(opts: { conjunction?: string } = {}): Promise<string> {
  return formatCitiesPhrase((await getTenantConfig()).majorCities, opts.conjunction);
}

/** Canonical site URL for the current tenant (server). */
export async function siteUrl(): Promise<string> {
  return (await getTenantConfig()).siteUrl;
}

/** App URL for the current tenant (server). */
export async function appUrl(): Promise<string> {
  return (await getTenantConfig()).appUrl;
}

/** The tenant's public Discord invite — used across all surfaces (server). */
export async function discordCommunityInvite(): Promise<string> {
  return (await getTenantConfig()).discordCommunityInvite;
}
