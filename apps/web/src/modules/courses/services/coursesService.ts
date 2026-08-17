import { and, eq } from "drizzle-orm";
import type { TenantStore } from "@/shared/db/tenantStore";
import { ok, type Result } from "@/shared/http/errors";
import { openTenantStore } from "@/shared/db/env";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";

export async function listCourses(
  citySlug: string,
): Promise<Result<{ courses: { id: string; title: string; slug: string; status: string }[] }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) return city;
  const store = openTenantStore(city.tenant);
  return ok({ courses: await listPublishedCourses(store) });
}

async function listPublishedCourses(store: TenantStore) {
  const { courses } = store.tables;
  const rows = await store.db
    .select()
    .from(courses)
    .where(and(eq(courses.orgId, store.orgId), eq(courses.status, "published")));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
  }));
}
