import { eq } from "drizzle-orm";
import { ok, type Result } from "@/shared/http/errors";
import { openTenantStore } from "@/shared/db/env";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";

export async function listTalks(
  citySlug: string,
): Promise<Result<{ talks: { id: string; title: string; status: string }[] }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) return city;
  const store = openTenantStore(city.tenant);
  const { talkSubmissions } = store.tables;
  const rows = await store.db
    .select()
    .from(talkSubmissions)
    .where(eq(talkSubmissions.orgId, store.orgId));
  return ok({
    talks: rows.map((r) => ({ id: r.id, title: r.title, status: r.status })),
  });
}
