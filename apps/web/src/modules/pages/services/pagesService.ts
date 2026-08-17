import { and, eq } from "drizzle-orm";
import { ok, type Result } from "@/shared/http/errors";
import { openTenantStore } from "@/shared/db/env";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";

export async function getPublishedPage(
  citySlug: string,
  pageSlug: string,
): Promise<Result<{ page: { id: string; title: string; bodyJson: string } | null }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) return city;
  const store = openTenantStore(city.tenant);
  const { pages } = store.tables;
  const rows = await store.db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.orgId, store.orgId),
        eq(pages.slug, pageSlug),
        eq(pages.status, "published"),
      ),
    )
    .limit(1);
  const row = rows[0];
  return ok({
    page: row ? { id: row.id, title: row.title, bodyJson: row.bodyJson } : null,
  });
}
