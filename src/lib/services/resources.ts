// Per-tenant resources (the /resources videos). Reads the `Resource` model —
// each row stores the rich VideoResource shape as a JSON `data` blob plus a few
// broken-out columns (slug, publishedAt, order, isPublished) for querying. The
// scoped client (getPrisma) filters every query to the current tenant.
import { getPrisma } from "@/lib/prisma";
import type { VideoResource } from "@/lib/resources";

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
