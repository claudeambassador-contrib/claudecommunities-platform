// Per-tenant resources (the /resources videos). Reads the `Resource` model —
// each row stores the rich VideoResource shape as a JSON `data` blob plus a few
// broken-out columns (slug, publishedAt, order, isPublished) for querying. The
// scoped client (getPrisma) filters every query to the current tenant.
import { getPrisma } from "@/lib/prisma";
import type { ResourceSpeaker, VideoResource } from "@/lib/resources";
import { revalidatePathSafe } from "@/lib/revalidate";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

/** The JSON document stored in `Resource.data` — everything except the columns. */
type ResourceDoc = Omit<VideoResource, "slug" | "publishedAt">;

/** Rebuild a VideoResource from a stored row (columns win over the JSON blob).
 * Throws on a malformed `data` blob — public callers below swallow that per-row
 * so one corrupt row can't 500 a whole page. */
function rowToVideoResource(row: {
  slug: string;
  publishedAt: string;
  data: string;
}): VideoResource {
  const doc = JSON.parse(row.data) as ResourceDoc;
  return { ...doc, slug: row.slug, publishedAt: row.publishedAt };
}

/** This tenant's published resources, most recent first. A corrupt row is
 * skipped rather than throwing (the write path validates, so this is belt-and-
 * suspenders against hand-edited data). */
export async function getResources(): Promise<VideoResource[]> {
  const db = await getPrisma();
  const rows = await db.resource.findMany({
    where: { isPublished: true },
    orderBy: [{ order: "asc" }, { publishedAt: "desc" }],
  });
  const out: VideoResource[] = [];
  for (const row of rows) {
    try {
      out.push(rowToVideoResource(row));
    } catch {
      // Skip a corrupt row rather than 500 the public page.
    }
  }
  return out;
}

/** A single published resource by slug for the current tenant, or null. */
export async function getResourceBySlug(slug: string): Promise<VideoResource | null> {
  const db = await getPrisma();
  const row = await db.resource.findFirst({ where: { slug, isPublished: true } });
  if (!row) return null;
  try {
    return rowToVideoResource(row);
  } catch {
    return null;
  }
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

/** Row summary for the admin list. */
export interface AdminResourceSummary {
  slug: string;
  title: string;
  publishedAt: string;
  isPublished: boolean;
}

/** The editor payload: the full VideoResource plus the publish flag. */
export type ResourceInput = VideoResource & { isPublished: boolean };

function reqStr(value: string | undefined, field: string): string {
  const v = (value ?? "").trim();
  if (!v) throw new ServiceError("bad_request", `${field} is required`);
  return v;
}

function normalizeSlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
    throw new ServiceError("bad_request", "Slug must be lowercase words separated by hyphens");
  }
  return s;
}

// ── Input validation ─────────────────────────────────────────────────────────
// Build a CLEAN, BOUNDED doc from the client payload. Server actions can be
// invoked directly (bypassing the UI), so the arg is untrusted: a bad shape
// (`tags: "x"`, `speakers: null`) or an oversized blob must not reach the DB or
// the public pages. Mirrors the stricter industries CMS validator.

const LIMITS = {
  title: 300,
  shortTitle: 300,
  summary: 1000,
  description: 4000,
  duration: 60,
  publishedAt: 40,
  tag: 60,
  tags: 20,
  takeaway: 400,
  takeaways: 30,
  speakerText: 300,
  bio: 4000,
  speakers: 12,
  url: 500,
} as const;

function clampStr(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampStrList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => clampStr(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Site-relative path or an http(s) URL only — blocks `javascript:`/`data:` hrefs. */
function safeUrl(value: unknown): string {
  const s = clampStr(value, LIMITS.url);
  if (!s) return "";
  if (s.startsWith("/")) return s;
  try {
    const proto = new URL(s).protocol;
    return proto === "http:" || proto === "https:" ? s : "";
  } catch {
    return "";
  }
}

/** A YouTube id is url-safe chars only; reject anything else — it lands in an
 * iframe `src` and the JSON-LD embed/content URLs. */
function validateYoutubeId(value: string): string {
  if (!/^[A-Za-z0-9_-]{8,20}$/.test(value)) {
    throw new ServiceError("bad_request", "YouTube video ID looks invalid");
  }
  return value;
}

/** Clean one speaker; returns null for an unnamed/blank entry (dropped). */
function validateSpeaker(value: unknown): ResourceSpeaker | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const name = clampStr(s.name, LIMITS.speakerText);
  if (!name) return null;
  const opt = (v: unknown, max: number): string | undefined => clampStr(v, max) || undefined;
  return {
    name,
    role: clampStr(s.role, LIMITS.speakerText),
    company: clampStr(s.company, LIMITS.speakerText),
    photo: safeUrl(s.photo),
    photoPosition: opt(s.photoPosition, 60),
    linkedin: safeUrl(s.linkedin),
    website: safeUrl(s.website) || undefined,
    websiteLabel: opt(s.websiteLabel, LIMITS.speakerText),
    companyLogo: safeUrl(s.companyLogo) || undefined,
    companyLogoAlt: opt(s.companyLogoAlt, LIMITS.speakerText),
    companyLogoInvert: typeof s.companyLogoInvert === "boolean" ? s.companyLogoInvert : undefined,
    bio: clampStr(s.bio, LIMITS.bio),
  };
}

/** Validate + split a ResourceInput into stored columns + a clean JSON `data` blob. */
function toRow(input: ResourceInput): {
  slug: string;
  publishedAt: string;
  isPublished: boolean;
  data: string;
} {
  const slug = normalizeSlug(reqStr(input.slug, "Slug"));
  const doc: ResourceDoc = {
    title: reqStr(input.title, "Title").slice(0, LIMITS.title),
    shortTitle: clampStr(input.shortTitle, LIMITS.shortTitle),
    description: clampStr(input.description, LIMITS.description),
    summary: clampStr(input.summary, LIMITS.summary),
    takeaways: clampStrList(input.takeaways, LIMITS.takeaways, LIMITS.takeaway),
    youtubeId: validateYoutubeId(reqStr(input.youtubeId, "YouTube ID")),
    duration: clampStr(input.duration, LIMITS.duration) || undefined,
    tags: clampStrList(input.tags, LIMITS.tags, LIMITS.tag),
    speakers: (Array.isArray(input.speakers) ? input.speakers : [])
      .map(validateSpeaker)
      .filter((s): s is ResourceSpeaker => s !== null)
      .slice(0, LIMITS.speakers),
  };
  return {
    slug,
    publishedAt: clampStr(input.publishedAt, LIMITS.publishedAt),
    isPublished: input.isPublished === true,
    data: JSON.stringify(doc),
  };
}

/** Invalidate the public resources pages after a mutation (they are ISR-cached). */
function revalidateResources(): void {
  revalidatePathSafe("/resources");
  revalidatePathSafe("/resources/[slug]", "page");
}

/** All of this tenant's resources (incl. unpublished) for the admin list. */
export async function listResourcesAdmin(actor: ActorLike): Promise<AdminResourceSummary[]> {
  ensurePermission(actor, "resources.view");
  const db = await getPrisma();
  const rows = await db.resource.findMany({
    orderBy: [{ order: "asc" }, { publishedAt: "desc" }],
  });
  return rows.map((r) => {
    let title = r.slug;
    try {
      title = (JSON.parse(r.data) as ResourceDoc).title || r.slug;
    } catch {
      // Corrupt row — fall back to the slug so the list still renders.
    }
    return { slug: r.slug, title, publishedAt: r.publishedAt, isPublished: r.isPublished };
  });
}

/** Load one resource for the editor. */
export async function getResourceForEdit(actor: ActorLike, slug: string): Promise<ResourceInput> {
  ensurePermission(actor, "resources.view");
  const db = await getPrisma();
  const row = await db.resource.findFirst({ where: { slug } });
  if (!row) throw new ServiceError("not_found", "Resource not found");
  return { ...rowToVideoResource(row), isPublished: row.isPublished };
}

/** Next append position for a new row. */
async function nextOrder(db: Awaited<ReturnType<typeof getPrisma>>): Promise<number> {
  const last = await db.resource.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  return last ? last.order + 1 : 0;
}

export async function createResource(actor: ActorLike, input: ResourceInput): Promise<string> {
  ensurePermission(actor, "resources.edit");
  const row = toRow(input);
  const db = await getPrisma();
  const dup = await db.resource.findFirst({ where: { slug: row.slug }, select: { id: true } });
  if (dup) throw new ServiceError("conflict", "A resource with this slug already exists");
  await db.resource.create({ data: { ...row, order: await nextOrder(db) } });
  revalidateResources();
  return row.slug;
}

/** Save an existing resource (slug fixed by the caller). */
export async function saveResource(
  actor: ActorLike,
  slug: string,
  input: ResourceInput,
): Promise<string> {
  ensurePermission(actor, "resources.edit");
  const row = toRow({ ...input, slug });
  const db = await getPrisma();
  const existing = await db.resource.findFirst({ where: { slug: row.slug }, select: { id: true } });
  if (!existing) throw new ServiceError("not_found", "Resource not found");
  await db.resource.updateMany({
    where: { slug: row.slug },
    data: { publishedAt: row.publishedAt, isPublished: row.isPublished, data: row.data },
  });
  revalidateResources();
  return row.slug;
}

export async function deleteResource(actor: ActorLike, slug: string): Promise<void> {
  ensurePermission(actor, "resources.delete");
  const db = await getPrisma();
  await db.resource.deleteMany({ where: { slug: slug.trim().toLowerCase() } });
  revalidateResources();
}
