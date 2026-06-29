/**
 * Industries service — admin-only writes for the per-tenant `/for/<slug>`
 * landing pages. Public reads go through `@/lib/industries` (the merge layer).
 *
 * Storage: one `IndustryPage` row per customized/added slug; the full `Vertical`
 * (minus `slug`, which is the column) is JSON in `data`. A built-in slug with no
 * row renders from `@/lib/verticals`; saving one for the first time CREATES an
 * override row. Tenant-scoped via `getPrisma()` (mirrors cities.ts).
 */
import { getIndustries, getIndustryBySlug } from "@/lib/industries";
import { isIndustryIcon } from "@/lib/industry-icons";
import { getPrisma } from "@/lib/prisma";
import { VERTICALS, type Vertical } from "@/lib/verticals";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

/** A row as the admin LIST consumes it. */
export interface AdminIndustrySummary {
  slug: string;
  name: string;
  tagline: string;
  /** Has a DB row (editable as an override / custom page; deletable). */
  custom: boolean;
  /** Backed by a built-in in `@/lib/verticals` (can't be fully removed). */
  builtIn: boolean;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function bad(message: string): never {
  throw new ServiceError("bad_request", message);
}

function reqStr(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) bad(`${field} is required`);
  return (v as string).trim();
}

function optStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strList(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) bad("Expected a list of strings");
  return v.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0);
}

type Raw = Record<string, unknown>;
function asObjArr(v: unknown, field: string): Raw[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) bad(`${field} must be a list`);
  return v.map((x) => (x && typeof x === "object" ? (x as Raw) : bad(`${field}: invalid entry`)));
}

function validateSlug(raw: unknown): string {
  const slug = (typeof raw === "string" ? raw : "").trim().toLowerCase();
  if (!slug) bad("Slug is required");
  if (!SLUG_RE.test(slug)) {
    bad(
      "Slug must be a single segment: lowercase letters, numbers, and single hyphens (no slashes)",
    );
  }
  return slug;
}

/**
 * Validate + normalise a full Vertical into `{ slug, data }` where `data` is the
 * JSON-serialised Vertical MINUS slug. Throws ServiceError on bad input.
 */
function validateIndustry(input: Vertical): { slug: string; data: string } {
  const slug = validateSlug(input.slug);

  const useCases = asObjArr(input.useCases, "Use cases").map((u, i) => {
    const icon = optStr(u.icon) || "Code";
    if (!isIndustryIcon(icon)) bad(`Use case ${i + 1}: icon "${icon}" is not allowed`);
    return {
      title: reqStr(u.title, `Use case ${i + 1} title`),
      description: reqStr(u.description, `Use case ${i + 1} description`),
      icon,
    };
  });

  const benefits = asObjArr(input.benefits, "Benefits").map((b, i) => ({
    stat: reqStr(b.stat, `Benefit ${i + 1} stat`),
    label: reqStr(b.label, `Benefit ${i + 1} label`),
  }));

  const features = asObjArr(input.features, "Features").map((f, i) => ({
    title: reqStr(f.title, `Feature ${i + 1} title`),
    description: reqStr(f.description, `Feature ${i + 1} description`),
    bulletPoints: strList(f.bulletPoints),
  }));

  const faqs = asObjArr(input.faqs, "FAQs").map((q, i) => ({
    question: reqStr(q.question, `FAQ ${i + 1} question`),
    answer: reqStr(q.answer, `FAQ ${i + 1} answer`),
  }));

  const data = {
    name: reqStr(input.name, "Name"),
    tagline: optStr(input.tagline),
    title: reqStr(input.title, "SEO title"),
    description: optStr(input.description),
    keywords: strList(input.keywords),
    ogTitle: optStr(input.ogTitle),
    ogDescription: optStr(input.ogDescription),
    heroHeading: reqStr(input.heroHeading, "Hero heading"),
    heroSubheading: optStr(input.heroSubheading),
    heroBadge: optStr(input.heroBadge),
    introParagraphs: strList(input.introParagraphs),
    useCases,
    benefits,
    features,
    faqs,
    relatedVerticals: strList(input.relatedVerticals),
    ctaHeading: optStr(input.ctaHeading),
    ctaDescription: optStr(input.ctaDescription),
  };
  return { slug, data: JSON.stringify(data) };
}

/** List effective industries (built-ins merged with DB overrides) for the admin. */
export async function listIndustriesAdmin(actor: ActorLike): Promise<AdminIndustrySummary[]> {
  ensurePermission(actor, "pages.view");
  const effective = await getIndustries();
  const db = await getPrisma();
  const rows = await db.industryPage.findMany({ select: { slug: true } });
  const dbSlugs = new Set(rows.map((r) => r.slug));
  const builtIn = new Set(VERTICALS.map((v) => v.slug));
  return effective.map((v) => ({
    slug: v.slug,
    name: v.name,
    tagline: v.tagline,
    custom: dbSlugs.has(v.slug),
    builtIn: builtIn.has(v.slug),
  }));
}

/** Load one industry for the editor (DB override if present, else the built-in). */
export async function getIndustryForEdit(
  actor: ActorLike,
  slug: string,
): Promise<{ vertical: Vertical; custom: boolean; builtIn: boolean }> {
  ensurePermission(actor, "pages.view");
  const vertical = await getIndustryBySlug(slug);
  if (!vertical) throw new ServiceError("not_found", "Industry page not found");
  const db = await getPrisma();
  const row = await db.industryPage.findFirst({
    where: { slug: vertical.slug },
    select: { id: true },
  });
  return {
    vertical,
    custom: !!row,
    builtIn: VERTICALS.some((v) => v.slug === vertical.slug),
  };
}

/** Next append position for a new DB row. */
async function nextPosition(db: Awaited<ReturnType<typeof getPrisma>>): Promise<number> {
  const last = await db.industryPage.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return last ? last.position + 1 : 0;
}

export async function createIndustry(actor: ActorLike, input: Vertical): Promise<string> {
  ensurePermission(actor, "pages.edit");
  const { slug, data } = validateIndustry(input);

  if (VERTICALS.some((v) => v.slug === slug)) {
    throw new ServiceError("conflict", "That slug is a built-in industry — edit it instead.");
  }
  const db = await getPrisma();
  const dup = await db.industryPage.findFirst({ where: { slug }, select: { id: true } });
  if (dup) throw new ServiceError("conflict", "An industry with this slug already exists");

  await db.industryPage.create({ data: { slug, data, position: await nextPosition(db) } });
  return slug;
}

/** Save an existing industry (slug fixed). Updates the override row, or creates it
 * the first time a built-in is customized. */
export async function saveIndustry(
  actor: ActorLike,
  slug: string,
  input: Vertical,
): Promise<string> {
  ensurePermission(actor, "pages.edit");
  const normalizedSlug = validateSlug(slug);
  const { data } = validateIndustry({ ...input, slug: normalizedSlug });

  const db = await getPrisma();
  const existing = await db.industryPage.findFirst({
    where: { slug: normalizedSlug },
    select: { id: true },
  });
  if (existing) {
    await db.industryPage.updateMany({ where: { slug: normalizedSlug }, data: { data } });
  } else {
    await db.industryPage.create({
      data: { slug: normalizedSlug, data, position: await nextPosition(db) },
    });
  }
  return normalizedSlug;
}

/** Delete the DB override for `slug` (reverts to the built-in if one exists). */
export async function deleteIndustry(actor: ActorLike, slug: string): Promise<void> {
  ensurePermission(actor, "pages.edit");
  const db = await getPrisma();
  await db.industryPage.deleteMany({ where: { slug: slug.trim().toLowerCase() } });
}
