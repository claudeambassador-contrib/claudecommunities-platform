/**
 * Home Page CMS — the no-blank-page core.
 *
 * `DEFAULT_HOME_SECTIONS` reproduces today's hardcoded home page as an ordered
 * block array with all override copy set to `null`, so it renders correctly for
 * any tenant from config alone (used whenever no `Page` row exists).
 *
 * The `resolve*` helpers are the SINGLE source of truth for default display
 * strings — imported by BOTH the renderer block components AND `generateMetadata`
 * so the visible hero and the `<meta>` description never drift. Each takes the
 * (possibly undefined) block + a `TenantConfig` and returns fully-resolved,
 * non-null strings. An override that is null OR empty falls back to the default
 * (so clearing a field in the editor restores the config-derived string).
 */
import type { TenantConfig } from "@/lib/tenant-config";
import type {
  AudienceCard,
  AudienceSplitBlock,
  BenefitCard,
  BenefitsBlock,
  Block,
  CtaBlock,
  GalleryBlock,
  HeroBlock,
  WebinarBlock,
} from "./blocks";

/** Default benefit cards — today's four (page.tsx:77-98). */
const DEFAULT_BENEFIT_CARDS: BenefitCard[] = [
  {
    icon: "Users",
    title: "Real Community",
    desc: "Connect with developers and creators who share your passion for AI-assisted development.",
  },
  {
    icon: "BookOpen",
    title: "Learn From Peers",
    desc: "Discover how others use Claude Code in their workflows. Share tips and best practices.",
  },
  {
    icon: "Star",
    title: "Ship Better Work",
    desc: "Get feedback on your projects, find collaborators, and build higher quality software faster.",
  },
  {
    icon: "LayoutGrid",
    title: "Hands-On Sessions",
    desc: "Participate in live coding sessions, workshops, and hackathons. Learn by doing.",
  },
];

/** Default audience cards — Professionals + Vibe Coders (page.tsx:323-356). */
const DEFAULT_AUDIENCE_CARDS: AudienceCard[] = [
  {
    href: "/professionals",
    icon: "Code",
    title: "Professional Developers",
    desc: "For software engineers, architects, and technical leads integrating Claude Code into production workflows.",
    ctaLabel: "Learn More →",
  },
  {
    href: "/vibe-coders",
    icon: "Paintbrush",
    title: "Vibe Coders",
    desc: "For creators, entrepreneurs, and curious minds exploring what's possible with AI-assisted development.",
    ctaLabel: "Learn More →",
  },
];

// ── Resolvers — the single source of truth for default strings ───────────────

export function resolveHero(
  block: HeroBlock | undefined,
  cfg: TenantConfig,
): { badge: string; heading: string; body: string; primaryCtaLabel: string } {
  return {
    badge: block?.badge || `${cfg.countryName}'s Claude Code Community`,
    heading: block?.heading || `Claude Code Meetups\nAcross ${cfg.countryName}`,
    body:
      block?.body ||
      `Join ${cfg.countryName}'s growing Claude AI community. Attend meetups, learn from peers, and build amazing things with Claude Code ${cfg.countryName}.`,
    primaryCtaLabel: block?.primaryCtaLabel || "View Upcoming Events",
  };
}

export function resolveBenefits(
  block: BenefitsBlock | undefined,
  _cfg: TenantConfig,
): { heading: string; cards: BenefitCard[] } {
  return {
    heading: block?.heading || "Why Join Claude Code Meetups?",
    cards: block?.cards && block.cards.length > 0 ? block.cards : DEFAULT_BENEFIT_CARDS,
  };
}

export function resolveAudienceSplit(
  block: AudienceSplitBlock | undefined,
  _cfg: TenantConfig,
): { heading: string; subheading: string; cards: AudienceCard[] } {
  return {
    heading: block?.heading || "Find Your Community",
    subheading:
      block?.subheading ||
      "Whether you're a seasoned developer or just getting started with AI tools, there's a place for you.",
    cards: block?.cards && block.cards.length > 0 ? block.cards : DEFAULT_AUDIENCE_CARDS,
  };
}

export function resolveGallery(
  block: GalleryBlock | undefined,
  cfg: TenantConfig,
): { heading: string; subheading: string } {
  return {
    heading: block?.heading || "From Our Claude Code Meetups",
    subheading:
      block?.subheading || `Real moments from Claude Code meetups across ${cfg.countryName}`,
  };
}

export function resolveCta(
  block: CtaBlock | undefined,
  cfg: TenantConfig,
): { headingSignedOut: string; bodySignedOut: string; ctaLabelSignedOut: string } {
  return {
    headingSignedOut: block?.headingSignedOut || "Ready to Join?",
    bodySignedOut:
      block?.bodySignedOut ||
      `Connect with the ${cfg.nationality} Claude Code community. Get access to exclusive events, resources, and a network of like-minded builders.`,
    ctaLabelSignedOut: block?.ctaLabelSignedOut || "Join the Community",
  };
}

/**
 * AU's webinar block — the seed (other agent) imports this so AU reproduces
 * today's enabled webinar bar. The webinar content has no source in config; it
 * was hardcoded in page.tsx. Note: `Australia` is intentionally literal here
 * (this constant is AU-specific), unlike the config-derived blocks.
 */
export const AU_WEBINAR_BLOCK: WebinarBlock = {
  id: "webinar",
  type: "webinar",
  enabled: true,
  href: "/webinars/claude-code-webinar-australia",
  title: "Claude Webinar — Claude Community Australia",
  description:
    "Watch our latest webinar with Rye Smith & Dominik Fretz on shipping with Claude Code in Australia.",
  thumbnailUrl: "https://img.youtube.com/vi/3-G3raRMl4w/maxresdefault.jpg",
};

/**
 * Copy a block with `enabled` overridden. Written as a function (not a
 * `{ ...block, enabled }` literal) so the bundler can't constant-fold the spread
 * into an object literal that lists `enabled` twice — which makes esbuild emit a
 * "Duplicate key" warning at build/deploy time.
 */
function withEnabled<T extends Block>(block: T, enabled: boolean): T {
  return { ...block, enabled };
}

/**
 * The generic code fallback used whenever no `Page` row exists. Reproduces
 * today's section order with all override copy null (config-derived at render).
 * The webinar block is present but DISABLED here — AU's enabled webinar lives in
 * AU's seed row, not in this generic baseline (no `REGION === "au"` check).
 */
export const DEFAULT_HOME_SECTIONS: Block[] = [
  {
    id: "hero",
    type: "hero",
    enabled: true,
    badge: null,
    heading: null,
    body: null,
    primaryCtaLabel: null,
  },
  withEnabled(AU_WEBINAR_BLOCK, false),
  { id: "benefits", type: "benefits", enabled: true, heading: null, cards: DEFAULT_BENEFIT_CARDS },
  {
    id: "audienceSplit",
    type: "audienceSplit",
    enabled: true,
    heading: null,
    subheading: null,
    cards: DEFAULT_AUDIENCE_CARDS,
  },
  { id: "events", type: "events", enabled: true },
  { id: "discord", type: "discord", enabled: true },
  { id: "gallery", type: "gallery", enabled: true, heading: null, subheading: null },
  {
    id: "cta",
    type: "cta",
    enabled: true,
    headingSignedOut: null,
    bodySignedOut: null,
    ctaLabelSignedOut: null,
  },
];
