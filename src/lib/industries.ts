/**
 * Industry ("vertical") landing pages — the public READ path for `/for/<slug>`.
 *
 * Runtime successor to the build-baked `VERTICALS` in `@/lib/verticals`, which
 * stays as the per-region BUILT-IN set (its copy interpolates the region via
 * `getRegionConfig()`, inlined per-region at build — so the fallback is always
 * region-correct, for free).
 *
 * `getIndustries()` is the SINGLE merge point: it overlays the tenant's
 * `IndustryPage` rows onto the built-ins by slug —
 *   • a DB row whose slug matches a built-in OVERRIDES it in place;
 *   • a net-new DB row APPENDS (after the built-ins) by `position`;
 *   • a tenant with no rows gets the built-ins unchanged.
 * `getIndustryBySlug` / `getIndustrySlugs` derive from it (`.find` / `.map`), so
 * list, detail, and sitemap can never diverge — and since it's `cache()`-memoized
 * the detail page (which needs both the page and the full list for "related")
 * hits one query. Known limitation: a built-in can be overridden or added-to but
 * not fully REMOVED (deleting a custom override reverts to the built-in).
 *
 * Tenant-scoped: reads via the SCOPED client (`getPrisma()`).
 */
import { cache } from "react";
import { getPrisma } from "@/lib/prisma";
import { VERTICALS, type Vertical } from "@/lib/verticals";

function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter(isStr) : [];
}

/**
 * Coerce a stored `data` JSON string + slug into a `Vertical`. Lenient (never
 * throws) — the write service validates on save; this just fails safe on a bad
 * row by dropping malformed nested entries.
 */
function parseIndustry(slug: string, raw: string): Vertical {
  let d: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") d = parsed as Record<string, unknown>;
  } catch {
    // fall through to defaults
  }
  const str = (k: string): string => (isStr(d[k]) ? (d[k] as string) : "");
  const objArr = (k: string): Record<string, unknown>[] =>
    Array.isArray(d[k])
      ? (d[k] as unknown[]).filter(
          (x): x is Record<string, unknown> => !!x && typeof x === "object",
        )
      : [];

  return {
    slug,
    name: str("name"),
    tagline: str("tagline"),
    title: str("title"),
    description: str("description"),
    keywords: strArr(d.keywords),
    ogTitle: str("ogTitle"),
    ogDescription: str("ogDescription"),
    heroHeading: str("heroHeading"),
    heroSubheading: str("heroSubheading"),
    heroBadge: str("heroBadge"),
    introParagraphs: strArr(d.introParagraphs),
    useCases: objArr("useCases").map((u) => ({
      title: isStr(u.title) ? u.title : "",
      description: isStr(u.description) ? u.description : "",
      icon: isStr(u.icon) ? u.icon : "Code",
    })),
    benefits: objArr("benefits").map((b) => ({
      stat: isStr(b.stat) ? b.stat : "",
      label: isStr(b.label) ? b.label : "",
    })),
    features: objArr("features").map((f) => ({
      title: isStr(f.title) ? f.title : "",
      description: isStr(f.description) ? f.description : "",
      bulletPoints: strArr(f.bulletPoints),
    })),
    faqs: objArr("faqs").map((q) => ({
      question: isStr(q.question) ? q.question : "",
      answer: isStr(q.answer) ? q.answer : "",
    })),
    relatedVerticals: strArr(d.relatedVerticals),
    ctaHeading: str("ctaHeading"),
    ctaDescription: str("ctaDescription"),
  };
}

/**
 * The current tenant's effective industries: built-ins overlaid with DB rows
 * (override-in-place by slug, then net-new appended by `position`).
 * Request-memoized.
 */
export const getIndustries = cache(async (): Promise<Vertical[]> => {
  const db = await getPrisma();
  const rows = await db.industryPage.findMany({ orderBy: [{ position: "asc" }, { slug: "asc" }] });
  const overrides = new Map(rows.map((r) => [r.slug, parseIndustry(r.slug, r.data)]));

  const merged: Vertical[] = VERTICALS.map((v) => overrides.get(v.slug) ?? v);
  const builtInSlugs = new Set(VERTICALS.map((v) => v.slug));
  for (const row of rows) {
    if (!builtInSlugs.has(row.slug)) merged.push(overrides.get(row.slug) as Vertical);
  }
  return merged;
});

/** One industry by slug, consistent with {@link getIndustries}. */
export async function getIndustryBySlug(slug: string): Promise<Vertical | undefined> {
  const wanted = slug.toLowerCase();
  return (await getIndustries()).find((v) => v.slug === wanted);
}

/** Every effective industry slug (for the sitemap). */
export async function getIndustrySlugs(): Promise<string[]> {
  return (await getIndustries()).map((v) => v.slug);
}
