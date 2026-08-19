import type { Block, BlockType, PageStatus } from "@/modules/pages/types";
import { type Empty, err, ok, type Result } from "@/shared/http/errors";

const MAX_BLOCKS = 30;
const MAX_PATH_SEGMENTS = 5;
const MAX_TITLE = 200;
const PATH_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const KNOWN_BLOCK_TYPES: ReadonlySet<string> = new Set<BlockType>([
  "audienceSplit",
  "benefits",
  "cta",
  "discord",
  "events",
  "gallery",
  "hero",
  "richText",
  "webinar",
]);

const ALLOWED_ICONS: ReadonlySet<string> = new Set([
  "BookOpen",
  "Code",
  "LayoutGrid",
  "Paintbrush",
  "Star",
  "Users",
]);

type Raw = Record<string, unknown>;

function bad(message: string): Result<never> {
  return err("bad_request", 400, message);
}

function isObj(v: unknown): v is Raw {
  return typeof v === "object" && v !== null;
}

function isOptStr(v: unknown): boolean {
  return v === undefined || v === null || typeof v === "string";
}

/** Internal path, hash, or https — default-deny for javascript:/data:/protocol-relative. */
export function isSafeLink(href: unknown): boolean {
  return (
    typeof href === "string" &&
    (href.startsWith("/") || href.startsWith("#") || href.startsWith("https://"))
  );
}

export function validateSlug(raw: unknown): Result<{ slug: string }> {
  if (typeof raw !== "string") {
    return bad("Path is required");
  }
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (!slug) {
    return bad("Path is required");
  }
  if (slug === "home") {
    return bad('"home" is reserved for the home page');
  }
  const segments = slug.split("/");
  if (segments.length > MAX_PATH_SEGMENTS) {
    return bad(`Path is too deeply nested (max ${MAX_PATH_SEGMENTS} segments)`);
  }
  for (const seg of segments) {
    if (!PATH_SEGMENT_RE.test(seg)) {
      return bad(
        `Invalid path segment "${seg}" — use lowercase letters, numbers, and single hyphens`,
      );
    }
  }
  return ok({ slug });
}

export function validateTitle(raw: unknown): Result<{ title: string }> {
  if (typeof raw !== "string") {
    return bad("Title is required");
  }
  const title = raw.trim();
  if (!title) {
    return bad("Title is required");
  }
  if (title.length > MAX_TITLE) {
    return bad(`Title is too long (max ${MAX_TITLE} characters)`);
  }
  return ok({ title });
}

export function validateStatus(raw: unknown): Result<{ status: PageStatus }> {
  if (raw === undefined) {
    return ok({ status: "draft" });
  }
  if (raw === "draft" || raw === "published") {
    return ok({ status: raw });
  }
  return bad("Invalid status");
}

function validateCards(cards: unknown, where: string, requireHref: boolean): Result<Empty> {
  if (!Array.isArray(cards)) {
    return bad(`${where}: cards must be an array`);
  }
  for (const [i, c] of cards.entries()) {
    const card = (c ?? {}) as Raw;
    if (typeof card.title !== "string" || typeof card.desc !== "string") {
      return bad(`${where}: card ${i} invalid`);
    }
    if (typeof card.icon !== "string" || !ALLOWED_ICONS.has(card.icon)) {
      return bad(`${where}: card ${i} icon not allowed`);
    }
    if (!isOptStr(card.ctaLabel)) {
      return bad(`${where}: card ${i} ctaLabel invalid`);
    }
    if (requireHref && !isSafeLink(card.href)) {
      return bad(`${where}: card ${i} href not allowed`);
    }
  }
  return ok({});
}

function optFields(okFields: boolean, message: string): Result<Empty> {
  return okFields ? ok({}) : bad(message);
}

const HOME_FIELD_VALIDATORS: Record<BlockType, (b: Raw, where: string) => Result<Empty>> = {
  audienceSplit: (b, where) =>
    isOptStr(b.heading) && isOptStr(b.subheading)
      ? validateCards(b.cards, where, true)
      : bad(`${where}: invalid audienceSplit heading`),
  benefits: (b, where) =>
    isOptStr(b.heading)
      ? validateCards(b.cards, where, false)
      : bad(`${where}: invalid benefits heading`),
  cta: (b, where) =>
    optFields(
      isOptStr(b.headingSignedOut) && isOptStr(b.bodySignedOut) && isOptStr(b.ctaLabelSignedOut),
      `${where}: invalid cta field`,
    ),
  discord: () => ok({}),
  events: () => ok({}),
  gallery: (b, where) =>
    optFields(isOptStr(b.heading) && isOptStr(b.subheading), `${where}: invalid gallery field`),
  hero: (b, where) =>
    optFields(
      isOptStr(b.badge) && isOptStr(b.heading) && isOptStr(b.body) && isOptStr(b.primaryCtaLabel),
      `${where}: invalid hero field`,
    ),
  richText: (b, where) => {
    if (typeof b.body !== "string") {
      return bad(`${where}: richText body must be a string`);
    }
    return optFields(isOptStr(b.heading), `${where}: invalid richText heading`);
  },
  webinar: (b, where) => {
    if (typeof b.title !== "string" || typeof b.description !== "string") {
      return bad(`${where}: invalid webinar field`);
    }
    if (!isSafeLink(b.href)) {
      return bad(`${where}: invalid webinar href`);
    }
    if (!isSafeLink(b.thumbnailUrl)) {
      return bad(`${where}: invalid webinar thumbnailUrl`);
    }
    return ok({});
  },
};

function validateHomeFields(b: Raw, type: BlockType, where: string): Result<Empty> {
  return HOME_FIELD_VALIDATORS[type](b, where);
}

function validateHomeBlock(raw: unknown, index: number): Result<Empty> {
  const where = `block ${index}`;
  if (!isObj(raw)) {
    return bad(`${where}: not an object`);
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return bad(`${where}: missing id`);
  }
  if (typeof raw.enabled !== "boolean") {
    return bad(`${where}: enabled must be a boolean`);
  }
  if (typeof raw.type !== "string" || !KNOWN_BLOCK_TYPES.has(raw.type)) {
    return bad(`${where}: unknown block type "${String(raw.type)}"`);
  }
  return validateHomeFields(raw, raw.type as BlockType, where);
}

export function validateHomeBlocks(blocks: unknown): Result<{ blocks: Block[] }> {
  if (!Array.isArray(blocks)) {
    return bad("blocks must be an array");
  }
  if (blocks.length > MAX_BLOCKS) {
    return bad(`too many blocks (max ${MAX_BLOCKS})`);
  }
  for (const [i, block] of blocks.entries()) {
    const checked = validateHomeBlock(block, i);
    if (!checked.ok) {
      return checked;
    }
  }
  return ok({ blocks: blocks as Block[] });
}

function validateContentBlock(raw: unknown, where: string): Result<Empty> {
  if (!isObj(raw)) {
    return bad(`${where}: not an object`);
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return bad(`${where}: missing id`);
  }
  if (typeof raw.enabled !== "boolean") {
    return bad(`${where}: enabled must be a boolean`);
  }
  if (raw.type !== "richText") {
    return bad(`${where}: only text sections are allowed on content pages`);
  }
  if (typeof raw.body !== "string") {
    return bad(`${where}: body must be a string`);
  }
  if (!isOptStr(raw.heading)) {
    return bad(`${where}: invalid heading`);
  }
  return ok({});
}

export function validateContentBlocks(blocks: unknown): Result<{ blocks: Block[] }> {
  if (!Array.isArray(blocks)) {
    return bad("blocks must be an array");
  }
  if (blocks.length > MAX_BLOCKS) {
    return bad(`too many sections (max ${MAX_BLOCKS})`);
  }
  for (const [i, raw] of blocks.entries()) {
    const checked = validateContentBlock(raw, `section ${i}`);
    if (!checked.ok) {
      return checked;
    }
  }
  return ok({ blocks: blocks as Block[] });
}

/**
 * Validate a single already-persisted home block. Legacy rows missing the
 * `cards` array on benefits/audienceSplit are normalized to `cards: []`;
 * anything else invalid is dropped (returns null) so rendering degrades
 * instead of trusting a blind cast.
 */
export function parseStoredHomeBlock(raw: unknown): Block | null {
  if (!isObj(raw)) {
    return null;
  }
  const needsCards =
    (raw.type === "benefits" || raw.type === "audienceSplit") && !Array.isArray(raw.cards);
  const candidate: Raw = needsCards ? { ...raw, cards: [] } : raw;
  const checked = validateHomeBlock(candidate, 0);
  return checked.ok ? (candidate as unknown as Block) : null;
}

/** Validate a single already-persisted content (richText) block, or null when invalid. */
export function parseStoredContentBlock(raw: unknown): Block | null {
  const checked = validateContentBlock(raw, "section");
  return checked.ok ? (raw as unknown as Block) : null;
}
