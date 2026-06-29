/**
 * Pages service — the authorized WRITE path for the Home Page CMS.
 *
 * Defense-in-depth: even though the server action gates with `<Can>` + a
 * permission check, this service independently `ensurePermission`s and
 * re-validates the entire block payload before persisting. Unknown block types
 * are REJECTED (not silently dropped) — the closed-library invariant.
 *
 * Persistence goes through the scoped client (`getPrisma()`), which auto-injects
 * `tenantId` (`Page` is registered in TENANT_SCOPED_MODELS). The tenant is
 * resolved from the request via `getTenantId()`, never from client input.
 */

import { type Block, type BlockType, isAllowedIcon } from "@/lib/cms/blocks";
import { parseContentSections } from "@/lib/cms/page";
import { getPrisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant-context";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

const MAX_BLOCKS = 30;

const KNOWN_TYPES: ReadonlySet<string> = new Set<BlockType>([
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

function bad(message: string): never {
  throw new ServiceError("bad_request", message);
}

/**
 * A link is acceptable iff it is an internal path (`/…` or `#…`) or an absolute
 * https URL. Default-deny — this rejects `javascript:`, `data:`, protocol-
 * relative, and casing/whitespace tricks for free.
 */
function isSafeLink(href: unknown): boolean {
  if (typeof href !== "string") return false;
  return href.startsWith("/") || href.startsWith("#") || href.startsWith("https://");
}

function isOptStr(v: unknown): boolean {
  return v === undefined || v === null || typeof v === "string";
}

type Raw = Record<string, unknown>;

/** Validate a benefits/audienceSplit card array (shared shape). */
function validateCards(cards: unknown, where: string, requireHref: boolean): void {
  if (!Array.isArray(cards)) bad(`${where}: cards must be an array`);
  cards.forEach((c, i) => {
    const card = (c ?? {}) as Raw;
    if (typeof card.title !== "string" || typeof card.desc !== "string")
      bad(`${where}: card ${i} invalid`);
    if (typeof card.icon !== "string" || !isAllowedIcon(card.icon))
      bad(`${where}: card ${i} icon not allowed`);
    if (!isOptStr(card.ctaLabel)) bad(`${where}: card ${i} ctaLabel invalid`);
    if (requireHref && !isSafeLink(card.href)) bad(`${where}: card ${i} href not allowed`);
  });
}

/** Per-type field validators. Each throws ServiceError on a malformed field. */
const VALIDATORS: Record<BlockType, (b: Raw, where: string) => void> = {
  hero: (b, where) => {
    if (
      !isOptStr(b.badge) ||
      !isOptStr(b.heading) ||
      !isOptStr(b.body) ||
      !isOptStr(b.primaryCtaLabel)
    )
      bad(`${where}: invalid hero field`);
  },
  webinar: (b, where) => {
    if (typeof b.title !== "string" || typeof b.description !== "string")
      bad(`${where}: invalid webinar field`);
    if (!isSafeLink(b.href)) bad(`${where}: invalid webinar href`);
    if (!isSafeLink(b.thumbnailUrl)) bad(`${where}: invalid webinar thumbnailUrl`);
  },
  benefits: (b, where) => {
    if (!isOptStr(b.heading)) bad(`${where}: invalid benefits heading`);
    validateCards(b.cards, where, false);
  },
  audienceSplit: (b, where) => {
    if (!isOptStr(b.heading) || !isOptStr(b.subheading))
      bad(`${where}: invalid audienceSplit heading`);
    validateCards(b.cards, where, true);
  },
  events: () => {},
  discord: () => {},
  gallery: (b, where) => {
    if (!isOptStr(b.heading) || !isOptStr(b.subheading)) bad(`${where}: invalid gallery field`);
  },
  cta: (b, where) => {
    if (
      !isOptStr(b.headingSignedOut) ||
      !isOptStr(b.bodySignedOut) ||
      !isOptStr(b.ctaLabelSignedOut)
    )
      bad(`${where}: invalid cta field`);
  },
  richText: (b, where) => {
    if (typeof b.body !== "string") bad(`${where}: richText body must be a string`);
    if (!isOptStr(b.heading)) bad(`${where}: invalid richText heading`);
  },
};

/** Validate one block (shared base fields + per-type dispatch). */
function validateBlock(raw: unknown, index: number): void {
  const where = `block ${index}`;
  if (typeof raw !== "object" || raw === null) bad(`${where}: not an object`);
  const b = raw as Raw;
  if (typeof b.id !== "string" || b.id.length === 0) bad(`${where}: missing id`);
  if (typeof b.enabled !== "boolean") bad(`${where}: enabled must be a boolean`);
  if (typeof b.type !== "string" || !KNOWN_TYPES.has(b.type)) {
    bad(`${where}: unknown block type "${String(b.type)}"`);
  }
  VALIDATORS[b.type as BlockType](b, where);
}

function validatePayload(blocks: unknown): asserts blocks is Block[] {
  if (!Array.isArray(blocks)) bad("blocks must be an array");
  if (blocks.length > MAX_BLOCKS) bad(`too many blocks (max ${MAX_BLOCKS})`);
  blocks.forEach(validateBlock);
}

/**
 * Validate + persist the tenant's home page sections. Upserts the single
 * `Page` row keyed by `(tenantId, "home")`. Returns the saved blocks.
 */
export async function saveHomeSections(actor: ActorLike, blocks: Block[]): Promise<Block[]> {
  ensurePermission(actor, "pages.edit");
  validatePayload(blocks);

  const tenantId = await getTenantId();
  const db = await getPrisma();
  const sections = JSON.stringify({ blocks });

  await db.page.upsert({
    where: { tenantId_key: { tenantId, key: "home" } },
    create: { key: "home", sections },
    update: { sections },
  });

  return blocks;
}

// ── Content pages (tenant-authored, keyed by URL path) ───────────────────────
//
// Custom pages live in the SAME `Page` table but are keyed by their URL path
// (the `key` column) instead of the magic `"home"`. They are served publicly at
// `/p/<path>` (see `src/app/t/[tenant]/p/[...slug]`) and carry a CLOSED
// richText-only palette — the home blocks resolve home-specific copy from config
// (see `@/lib/cms/defaults`), so they're rejected here.

/** "home" is rendered at `/`, never as a content page; nested paths form folders. */
const PATH_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PATH_SEGMENTS = 5;

/** A content page as the admin LIST consumes it. `path` is the `key` column. */
export interface ContentPageSummary {
  id: string;
  path: string;
  title: string;
}

/** A content page as the admin EDITOR consumes it (summary + its blocks). */
export interface ContentPageDetail extends ContentPageSummary {
  blocks: Block[];
}

export interface ContentPageInput {
  path: string;
  title: string;
  blocks: Block[];
}

/**
 * Validate + normalise a page path into the `key` column form: lowercase,
 * url-safe segments joined by `/` (the slashes ARE the folder structure), no
 * leading/trailing slash. Rejects the reserved `"home"`.
 */
function validatePath(raw: unknown): string {
  if (typeof raw !== "string") bad("Path is required");
  const path = raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (!path) bad("Path is required");
  if (path === "home") bad('"home" is reserved for the home page');
  const segments = path.split("/");
  if (segments.length > MAX_PATH_SEGMENTS) {
    bad(`Path is too deeply nested (max ${MAX_PATH_SEGMENTS} segments)`);
  }
  for (const seg of segments) {
    if (!PATH_SEGMENT_RE.test(seg)) {
      bad(`Invalid path segment "${seg}" — use lowercase letters, numbers, and single hyphens`);
    }
  }
  return path;
}

/** Validate the richText-only block payload for a content page. */
function validateContentBlocks(blocks: unknown): asserts blocks is Block[] {
  if (!Array.isArray(blocks)) bad("blocks must be an array");
  if (blocks.length > MAX_BLOCKS) bad(`too many sections (max ${MAX_BLOCKS})`);
  blocks.forEach((raw, i) => {
    const where = `section ${i}`;
    if (typeof raw !== "object" || raw === null) bad(`${where}: not an object`);
    const b = raw as Raw;
    if (typeof b.id !== "string" || b.id.length === 0) bad(`${where}: missing id`);
    if (typeof b.enabled !== "boolean") bad(`${where}: enabled must be a boolean`);
    if (b.type !== "richText") bad(`${where}: only text sections are allowed on content pages`);
    if (typeof b.body !== "string") bad(`${where}: body must be a string`);
    if (!isOptStr(b.heading)) bad(`${where}: invalid heading`);
  });
}

function validateTitle(raw: unknown): string {
  if (typeof raw !== "string") bad("Title is required");
  const title = raw.trim();
  if (!title) bad("Title is required");
  if (title.length > 200) bad("Title is too long (max 200 characters)");
  return title;
}

function toSummary(row: { id: string; key: string; title: string | null }): ContentPageSummary {
  return { id: row.id, path: row.key, title: row.title ?? row.key };
}

/** List the tenant's content pages (everything except the home row). */
export async function listContentPages(actor: ActorLike): Promise<ContentPageSummary[]> {
  ensurePermission(actor, "pages.view");
  const db = await getPrisma();
  const rows = await db.page.findMany({
    where: { key: { not: "home" } },
    select: { id: true, key: true, title: true },
    orderBy: { key: "asc" },
  });
  return rows.map(toSummary);
}

/** Load one content page by id for the editor. Throws not_found for home / missing. */
export async function getContentPage(actor: ActorLike, id: string): Promise<ContentPageDetail> {
  ensurePermission(actor, "pages.view");
  const db = await getPrisma();
  const row = await db.page.findFirst({
    where: { id },
    select: { id: true, key: true, title: true, sections: true },
  });
  if (!row || row.key === "home") throw new ServiceError("not_found", "Page not found");
  return { ...toSummary(row), blocks: parseContentSections(row.sections) };
}

export async function createContentPage(
  actor: ActorLike,
  input: ContentPageInput,
): Promise<ContentPageSummary> {
  ensurePermission(actor, "pages.edit");
  const path = validatePath(input.path);
  const title = validateTitle(input.title);
  validateContentBlocks(input.blocks);

  const db = await getPrisma();
  const existing = await db.page.findFirst({ where: { key: path }, select: { id: true } });
  if (existing) throw new ServiceError("conflict", "A page with this path already exists");

  const row = await db.page.create({
    data: { key: path, title, sections: JSON.stringify({ blocks: input.blocks }) },
    select: { id: true, key: true, title: true },
  });
  return toSummary(row);
}

export async function updateContentPage(
  actor: ActorLike,
  id: string,
  input: ContentPageInput,
): Promise<ContentPageSummary> {
  ensurePermission(actor, "pages.edit");
  const path = validatePath(input.path);
  const title = validateTitle(input.title);
  validateContentBlocks(input.blocks);

  const db = await getPrisma();
  const current = await db.page.findFirst({ where: { id }, select: { id: true, key: true } });
  if (!current || current.key === "home") throw new ServiceError("not_found", "Page not found");

  // If the path changed, ensure the new one is free (scoped — unique per tenant).
  if (path !== current.key) {
    const dup = await db.page.findFirst({ where: { key: path }, select: { id: true } });
    if (dup) throw new ServiceError("conflict", "A page with this path already exists");
  }

  // id isn't injectable into findUnique on the scoped client; updateMany-by-id
  // lets the chokepoint add the tenantId filter (mirrors cities.ts).
  await db.page.updateMany({
    where: { id },
    data: { key: path, title, sections: JSON.stringify({ blocks: input.blocks }) },
  });
  return { id, path, title };
}

export async function deleteContentPage(actor: ActorLike, id: string): Promise<void> {
  ensurePermission(actor, "pages.edit");
  const db = await getPrisma();
  const current = await db.page.findFirst({ where: { id }, select: { id: true, key: true } });
  if (!current || current.key === "home") throw new ServiceError("not_found", "Page not found");
  await db.page.deleteMany({ where: { id } });
}
