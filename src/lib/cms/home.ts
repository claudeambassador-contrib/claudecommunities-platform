/**
 * Home Page CMS — the public READ path.
 *
 * `getHomeSections()` is request-memoized (React `cache()`, same pattern as
 * `getTenantConfig`) and is called by BOTH the page renderer and
 * `generateMetadata`, so the `Page` row is read once per request. It never
 * throws to a visitor: an absent / empty / malformed row coerces to
 * `DEFAULT_HOME_SECTIONS`.
 *
 * `parseSections` is the pure validator (unit-testable): it accepts the stored
 * JSON string and returns only the well-formed blocks of a known `BlockType`.
 * Unknown types are dropped on read (v1 is a closed library; the save service
 * rejects unknown types, so no app-originated row can contain one).
 */
import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import type {
  AudienceCard,
  AudienceSplitBlock,
  BenefitCard,
  BenefitsBlock,
  Block,
  BlockType,
  CtaBlock,
  DiscordBlock,
  EventsBlock,
  GalleryBlock,
  HeroBlock,
  RichTextBlock,
  WebinarBlock,
} from "./blocks";
import { DEFAULT_HOME_SECTIONS } from "./defaults";

const KNOWN_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  "hero",
  "webinar",
  "benefits",
  "audienceSplit",
  "events",
  "discord",
  "gallery",
  "cta",
  "richText",
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function optStr(v: unknown): boolean {
  return v === undefined || v === null || typeof v === "string";
}

function validBenefitCards(v: unknown): v is BenefitCard[] {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        isObj(c) &&
        typeof c.icon === "string" &&
        typeof c.title === "string" &&
        typeof c.desc === "string",
    )
  );
}

function validAudienceCards(v: unknown): v is AudienceCard[] {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        isObj(c) &&
        typeof c.href === "string" &&
        typeof c.icon === "string" &&
        typeof c.title === "string" &&
        typeof c.desc === "string" &&
        optStr(c.ctaLabel),
    )
  );
}

type Base = { id: string; enabled: boolean };
type Coercer = (r: Record<string, unknown>, base: Base) => Block | null;

/** Per-type coercion. Each returns a typed Block or null when fields are bad. */
const COERCERS: Record<BlockType, Coercer> = {
  hero: (r, base) =>
    optStr(r.badge) && optStr(r.heading) && optStr(r.body) && optStr(r.primaryCtaLabel)
      ? ({
          ...base,
          type: "hero",
          badge: r.badge,
          heading: r.heading,
          body: r.body,
          primaryCtaLabel: r.primaryCtaLabel,
        } as HeroBlock)
      : null,
  webinar: (r, base) =>
    typeof r.href === "string" &&
    typeof r.title === "string" &&
    typeof r.description === "string" &&
    typeof r.thumbnailUrl === "string"
      ? ({
          ...base,
          type: "webinar",
          href: r.href,
          title: r.title,
          description: r.description,
          thumbnailUrl: r.thumbnailUrl,
        } as WebinarBlock)
      : null,
  benefits: (r, base) =>
    optStr(r.heading) && validBenefitCards(r.cards)
      ? ({ ...base, type: "benefits", heading: r.heading, cards: r.cards } as BenefitsBlock)
      : null,
  audienceSplit: (r, base) =>
    optStr(r.heading) && optStr(r.subheading) && validAudienceCards(r.cards)
      ? ({
          ...base,
          type: "audienceSplit",
          heading: r.heading,
          subheading: r.subheading,
          cards: r.cards,
        } as AudienceSplitBlock)
      : null,
  events: (_r, base) => ({ ...base, type: "events" }) as EventsBlock,
  discord: (_r, base) => ({ ...base, type: "discord" }) as DiscordBlock,
  gallery: (r, base) =>
    optStr(r.heading) && optStr(r.subheading)
      ? ({ ...base, type: "gallery", heading: r.heading, subheading: r.subheading } as GalleryBlock)
      : null,
  cta: (r, base) =>
    optStr(r.headingSignedOut) && optStr(r.bodySignedOut) && optStr(r.ctaLabelSignedOut)
      ? ({
          ...base,
          type: "cta",
          headingSignedOut: r.headingSignedOut,
          bodySignedOut: r.bodySignedOut,
          ctaLabelSignedOut: r.ctaLabelSignedOut,
        } as CtaBlock)
      : null,
  richText: (r, base) =>
    typeof r.body === "string" && optStr(r.heading)
      ? ({ ...base, type: "richText", heading: r.heading, body: r.body } as RichTextBlock)
      : null,
};

/**
 * Validate one raw object into a typed Block, or null if malformed. Unknown
 * `type` returns null (dropped on read).
 */
function coerceBlock(raw: unknown): Block | null {
  if (!isObj(raw)) return null;
  const { id, type, enabled } = raw;
  if (typeof id !== "string" || typeof type !== "string") return null;
  if (typeof enabled !== "boolean") return null;
  if (!KNOWN_TYPES.has(type as BlockType)) return null;
  return COERCERS[type as BlockType](raw, { id, enabled });
}

/**
 * Parse + validate the stored `sections` JSON. Accepts either `{ blocks: [...] }`
 * or a bare `[...]`. Returns `DEFAULT_HOME_SECTIONS` when nothing valid remains.
 * Never throws.
 */
export function parseSections(raw: string | null | undefined): Block[] {
  if (!raw) return DEFAULT_HOME_SECTIONS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_HOME_SECTIONS;
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : isObj(parsed) && Array.isArray(parsed.blocks)
      ? parsed.blocks
      : null;
  if (!arr) return DEFAULT_HOME_SECTIONS;

  const blocks = arr.map(coerceBlock).filter((b): b is Block => b !== null);
  return blocks.length > 0 ? blocks : DEFAULT_HOME_SECTIONS;
}

/**
 * The current tenant's home sections. Request-memoized. Reads the scoped `Page`
 * row (`key="home"`) and falls back to the code default when absent/invalid.
 */
export const getHomeSections = cache(async (): Promise<Block[]> => {
  const db = await getPrisma();
  const row = await db.page.findFirst({ where: { key: "home" }, select: { sections: true } });
  return parseSections(row?.sections);
});
