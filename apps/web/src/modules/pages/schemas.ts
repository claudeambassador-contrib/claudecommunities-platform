import { z } from "zod";
import type { Block, BlockType } from "@/modules/pages/types";

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

const ALLOWED_ICONS = ["BookOpen", "Code", "LayoutGrid", "Paintbrush", "Star", "Users"] as const;

/** Internal path, hash, or https — default-deny for javascript:/data:/protocol-relative. */
export function isSafeLink(href: unknown): boolean {
  return (
    typeof href === "string" &&
    (href.startsWith("/") || href.startsWith("#") || href.startsWith("https://"))
  );
}

function safeLink(field: string) {
  return z.string().refine(isSafeLink, `${field} not allowed`);
}

/** Missing/non-string input becomes "" so `min(1, message)` still fires. */
function requiredTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Undefined/null/any-string pass through unchanged — matches the old optional-string predicate. */
const optStr = z.string().nullish();

function normalizeSlug(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

/**
 * `createContentPage`/`updateContentPage`'s slug rule — normalizes (trim,
 * lowercase, strip leading/trailing slashes) before checking non-empty,
 * the reserved `"home"` slug, max path depth, and per-segment charset.
 * The per-segment / depth / reserved checks stay as a `superRefine`
 * post-parse walk (not expressible as declarative zod string rules)
 * so each keeps its own distinct message, matching the old validator.
 */
export const pageSlugInput = z
  .preprocess(normalizeSlug, z.string().min(1, "Path is required"))
  .superRefine((slug, ctx) => {
    if (slug === "home") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"home" is reserved for the home page',
      });
      return;
    }
    const segments = slug.split("/");
    if (segments.length > MAX_PATH_SEGMENTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Path is too deeply nested (max ${MAX_PATH_SEGMENTS} segments)`,
      });
      return;
    }
    for (const seg of segments) {
      if (!PATH_SEGMENT_RE.test(seg)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid path segment "${seg}" — use lowercase letters, numbers, and single hyphens`,
        });
        return;
      }
    }
  });

/** `createContentPage`/`updateContentPage`'s title rule. */
export const pageTitleInput = z.preprocess(
  requiredTrim,
  z
    .string()
    .min(1, "Title is required")
    .max(MAX_TITLE, `Title is too long (max ${MAX_TITLE} characters)`),
);

/** `createContentPage`'s status rule — defaults to `"draft"` when absent. */
export const pageStatusCreateInput = z.preprocess(
  (raw) => (raw === undefined ? "draft" : raw),
  z.enum(["draft", "published"], { message: "Invalid status" }),
);

/** `updateContentPage`'s status rule — only checked when the field is present. */
export const pageStatusPatchInput = z
  .enum(["draft", "published"], { message: "Invalid status" })
  .optional();

const audienceCard = z.object({
  ctaLabel: optStr,
  desc: z.string(),
  href: safeLink("href"),
  icon: z.enum(ALLOWED_ICONS),
  title: z.string(),
});

const benefitCard = z.object({
  desc: z.string(),
  icon: z.enum(ALLOWED_ICONS),
  title: z.string(),
});

const blockId = z.string().min(1, "missing id");
const enabledFlag = z.boolean();

/**
 * Home-page block union — one variant per `BlockType`, mirroring the old
 * `HOME_FIELD_VALIDATORS` table field-for-field (including which fields were
 * optional vs. required, and the `cards`/href safe-link rules).
 */
export const homeBlockInput = z.discriminatedUnion("type", [
  z.object({
    cards: z.array(audienceCard),
    enabled: enabledFlag,
    heading: optStr,
    id: blockId,
    subheading: optStr,
    type: z.literal("audienceSplit"),
  }),
  z.object({
    cards: z.array(benefitCard),
    enabled: enabledFlag,
    heading: optStr,
    id: blockId,
    type: z.literal("benefits"),
  }),
  z.object({
    bodySignedOut: optStr,
    ctaLabelSignedOut: optStr,
    enabled: enabledFlag,
    headingSignedOut: optStr,
    id: blockId,
    type: z.literal("cta"),
  }),
  z.object({ enabled: enabledFlag, id: blockId, type: z.literal("discord") }),
  z.object({ enabled: enabledFlag, id: blockId, type: z.literal("events") }),
  z.object({
    enabled: enabledFlag,
    heading: optStr,
    id: blockId,
    subheading: optStr,
    type: z.literal("gallery"),
  }),
  z.object({
    badge: optStr,
    body: optStr,
    enabled: enabledFlag,
    heading: optStr,
    id: blockId,
    primaryCtaLabel: optStr,
    type: z.literal("hero"),
  }),
  z.object({
    body: z.string(),
    enabled: enabledFlag,
    heading: optStr,
    id: blockId,
    type: z.literal("richText"),
  }),
  z.object({
    description: z.string(),
    enabled: enabledFlag,
    href: safeLink("href"),
    id: blockId,
    thumbnailUrl: safeLink("thumbnailUrl"),
    title: z.string(),
    type: z.literal("webinar"),
  }),
]);

/** Content-page block — only `richText` sections are allowed. */
export const contentBlockInput = z.object({
  body: z.string(),
  enabled: enabledFlag,
  heading: optStr,
  id: blockId,
  type: z.literal("richText"),
});

export const homeBlocksInput = z
  .array(homeBlockInput)
  .max(MAX_BLOCKS, `too many blocks (max ${MAX_BLOCKS})`);

export const contentBlocksInput = z
  .array(contentBlockInput)
  .max(MAX_BLOCKS, `too many sections (max ${MAX_BLOCKS})`);

/**
 * Validate a single already-persisted home block. Legacy rows missing the
 * `cards` array on benefits/audienceSplit are normalized to `cards: []`;
 * anything else invalid is dropped (returns null) so rendering degrades
 * instead of trusting a blind cast.
 */
export function parseStoredHomeBlock(raw: unknown): Block | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const needsCards =
    (row.type === "benefits" || row.type === "audienceSplit") && !Array.isArray(row.cards);
  const candidate = needsCards ? { ...row, cards: [] } : row;
  const parsed = homeBlockInput.safeParse(candidate);
  return parsed.success ? (parsed.data as Block) : null;
}

/** Validate a single already-persisted content (richText) block, or null when invalid. */
export function parseStoredContentBlock(raw: unknown): Block | null {
  const parsed = contentBlockInput.safeParse(raw);
  return parsed.success ? (parsed.data as Block) : null;
}
