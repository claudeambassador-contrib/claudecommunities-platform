/**
 * Home Page CMS — the typed block library.
 *
 * A closed, small set of block types. Every block carries `id` (stable key for
 * React + reorder identity), a `type` discriminant, and `enabled`. Copy fields
 * marked `?: string | null` are OPTIONAL OVERRIDES — when null/empty the
 * renderer fills them from `TenantConfig` via the resolvers in `./defaults`.
 *
 * This module is the CONTRACT consumed by the page renderer, the admin editor,
 * the read loader (`./home`), and the write service (`@/lib/services/pages`).
 */

/** Discriminant for every block in the home sections array. */
export type BlockType =
  | "hero"
  | "webinar"
  | "benefits"
  | "audienceSplit"
  | "events" // marker only — renders the dynamic <EventsSection/>
  | "discord"
  | "gallery" // marker + headings; images still come from config.galleryImages
  | "cta"
  | "richText";

export interface BlockBase {
  id: string;
  enabled: boolean;
}

/**
 * Hero. ALL copy fields are OPTIONAL OVERRIDES — null/empty resolves to the
 * config-derived default (see `resolveHero`). The heading default contains a
 * literal `\n`; the renderer splits on it and joins with `<br/>`.
 */
export interface HeroBlock extends BlockBase {
  type: "hero";
  badge?: string | null;
  heading?: string | null;
  body?: string | null;
  primaryCtaLabel?: string | null;
}

/** Webinar promo bar. Owns its own structured fields (no config fallback). */
export interface WebinarBlock extends BlockBase {
  type: "webinar";
  href: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export interface BenefitCard {
  icon: string; // name from ALLOWED_ICONS
  title: string;
  desc: string;
}
export interface BenefitsBlock extends BlockBase {
  type: "benefits";
  heading?: string | null;
  cards: BenefitCard[];
}

export interface AudienceCard {
  href: string; // internal path or https URL (validated on save)
  icon: string; // name from ALLOWED_ICONS
  title: string;
  desc: string;
  ctaLabel?: string | null;
}
export interface AudienceSplitBlock extends BlockBase {
  type: "audienceSplit";
  heading?: string | null;
  subheading?: string | null;
  cards: AudienceCard[];
}

/** Marker: renders the dynamic <EventsSection/>. No CMS data. */
export interface EventsBlock extends BlockBase {
  type: "events";
}

export interface DiscordBlock extends BlockBase {
  type: "discord";
  // href defaults to discordCommunityInvite() from config; logoSrc fixed.
}

/** Marker + headings; images keep coming from config.galleryImages. */
export interface GalleryBlock extends BlockBase {
  type: "gallery";
  heading?: string | null;
  subheading?: string | null;
}

export interface CtaBlock extends BlockBase {
  type: "cta";
  // Signed-in variant stays auth-driven; these are the signed-out overrides.
  headingSignedOut?: string | null;
  bodySignedOut?: string | null;
  ctaLabelSignedOut?: string | null;
}

/**
 * The single generic block — the "add your own content" capability. Body is
 * PLAIN TEXT only in v1 (rendered via `whitespace-pre-line`), never raw HTML.
 */
export interface RichTextBlock extends BlockBase {
  type: "richText";
  heading?: string | null;
  body: string;
}

export type Block =
  | HeroBlock
  | WebinarBlock
  | BenefitsBlock
  | AudienceSplitBlock
  | EventsBlock
  | DiscordBlock
  | GalleryBlock
  | CtaBlock
  | RichTextBlock;

export interface PageSections {
  blocks: Block[];
}

/**
 * Lucide icon names allowed in `icon` fields. Constrained to the set the
 * defaults use so the editor offers a fixed picker and the save path can reject
 * arbitrary strings (no arbitrary icon imports). Extend deliberately.
 */
export const ALLOWED_ICONS = [
  "Users",
  "BookOpen",
  "Star",
  "LayoutGrid",
  "Code",
  "Paintbrush",
] as const;

export type AllowedIcon = (typeof ALLOWED_ICONS)[number];

/** True iff `name` is a member of the lucide allowlist. */
export function isAllowedIcon(name: string): boolean {
  return (ALLOWED_ICONS as readonly string[]).includes(name);
}

/** Human-readable labels for each block type (used by the admin editor). */
export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  webinar: "Webinar bar",
  benefits: "Benefits",
  audienceSplit: "Audience split",
  events: "Events",
  discord: "Discord",
  gallery: "Gallery",
  cta: "Call to action",
  richText: "Rich text",
};
