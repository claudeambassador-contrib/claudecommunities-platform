// Per-tenant resources (the /resources videos). Reads the `Resource` model —
// each row stores the rich VideoResource shape as a JSON `data` blob plus a few
// broken-out columns (slug, publishedAt, order, isPublished) for querying. The
// scoped client (getPrisma) filters every query to the current tenant.
import { getPrisma } from "@/lib/prisma";
import type { VideoResource } from "@/lib/resources";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

/** The JSON document stored in `Resource.data` — everything except the columns. */
type ResourceDoc = Omit<VideoResource, "slug" | "publishedAt">;

/** Rebuild a VideoResource from a stored row (columns win over the JSON blob). */
function rowToVideoResource(row: {
  slug: string;
  publishedAt: string;
  data: string;
}): VideoResource {
  const doc = JSON.parse(row.data) as ResourceDoc;
  return { ...doc, slug: row.slug, publishedAt: row.publishedAt };
}

/** This tenant's published resources, most recent first. */
export async function getResources(): Promise<VideoResource[]> {
  const db = await getPrisma();
  const rows = await db.resource.findMany({
    where: { isPublished: true },
    orderBy: [{ order: "asc" }, { publishedAt: "desc" }],
  });
  return rows.map(rowToVideoResource);
}

/** A single published resource by slug for the current tenant, or null. */
export async function getResourceBySlug(slug: string): Promise<VideoResource | null> {
  const db = await getPrisma();
  const row = await db.resource.findFirst({ where: { slug, isPublished: true } });
  return row ? rowToVideoResource(row) : null;
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

/** Split a ResourceInput into the stored columns + the JSON `data` blob. */
function toRow(input: ResourceInput): {
  slug: string;
  publishedAt: string;
  isPublished: boolean;
  data: string;
} {
  const slug = normalizeSlug(reqStr(input.slug, "Slug"));
  reqStr(input.title, "Title");
  reqStr(input.youtubeId, "YouTube ID");
  // Strip the broken-out columns from the doc so `data` matches ResourceDoc.
  const { slug: _s, publishedAt: _p, isPublished: _i, ...doc } = input;
  return {
    slug,
    publishedAt: (input.publishedAt ?? "").trim(),
    isPublished: input.isPublished,
    data: JSON.stringify(doc),
  };
}

/** All of this tenant's resources (incl. unpublished) for the admin list. */
export async function listResourcesAdmin(actor: ActorLike): Promise<AdminResourceSummary[]> {
  ensurePermission(actor, "resources.view");
  const db = await getPrisma();
  const rows = await db.resource.findMany({
    orderBy: [{ order: "asc" }, { publishedAt: "desc" }],
  });
  return rows.map((r) => {
    const doc = JSON.parse(r.data) as ResourceDoc;
    return {
      slug: r.slug,
      title: doc.title,
      publishedAt: r.publishedAt,
      isPublished: r.isPublished,
    };
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
  return row.slug;
}

export async function deleteResource(actor: ActorLike, slug: string): Promise<void> {
  ensurePermission(actor, "resources.delete");
  const db = await getPrisma();
  await db.resource.deleteMany({ where: { slug: slug.trim().toLowerCase() } });
}
