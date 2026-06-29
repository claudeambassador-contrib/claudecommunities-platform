/**
 * Content-page CMS — the public READ path for tenant-authored pages.
 *
 * Distinct from `./home`: a content page lives in the SAME `Page` table but is
 * keyed by its URL path (the `key` column), not the magic `"home"`. The crucial
 * difference is the fallback — `getHomeSections` returns `DEFAULT_HOME_SECTIONS`
 * when a row is empty so the home page is never blank, but a content page must
 * NEVER inherit the home layout: an empty/absent content page renders empty (and
 * the route 404s on a missing row), so `parseContentSections` returns `[]`, never
 * the home default.
 *
 * Content pages are a CLOSED `richText`-only palette (heading + plain-text body)
 * — the other block types resolve home-specific copy from config (see
 * `./defaults`), which would bleed into a generic page. The write service
 * (`@/lib/services/pages`) rejects non-richText blocks; this reader drops them.
 */
import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import type { Block, RichTextBlock } from "./blocks";

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function optStr(v: unknown): boolean {
  return v === undefined || v === null || typeof v === "string";
}

/** Coerce one raw object into a richText Block, or null if malformed / other type. */
function coerceRichText(raw: unknown): RichTextBlock | null {
  if (!isObj(raw)) return null;
  const { id, type, enabled, heading, body } = raw;
  if (typeof id !== "string" || type !== "richText" || typeof enabled !== "boolean") return null;
  if (typeof body !== "string" || !optStr(heading)) return null;
  return { id, type: "richText", enabled, heading: (heading as string | null) ?? null, body };
}

/**
 * Parse the stored `sections` JSON into the page's ACTUAL richText blocks.
 * Accepts `{ blocks: [...] }` or a bare `[...]`. Returns `[]` (never the home
 * default) on anything malformed/empty. Never throws.
 */
export function parseContentSections(raw: string | null | undefined): Block[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : isObj(parsed) && Array.isArray(parsed.blocks)
      ? parsed.blocks
      : null;
  if (!arr) return [];
  return arr.map(coerceRichText).filter((b): b is RichTextBlock => b !== null);
}

/**
 * The current tenant's content page at `path` (the `key` column), or null when
 * no row exists. Request-memoized per path. `"home"` is reserved (served at `/`),
 * so it never resolves here — guarding against `/p/home` mirroring the home page.
 */
export const getPageByPath = cache(
  async (path: string): Promise<{ title: string | null; blocks: Block[] } | null> => {
    if (path === "home") return null;
    const db = await getPrisma();
    const row = await db.page.findFirst({
      where: { key: path },
      select: { title: true, sections: true },
    });
    if (!row) return null;
    return { title: row.title, blocks: parseContentSections(row.sections) };
  },
);
