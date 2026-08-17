import { eq } from "drizzle-orm";
import { ok, type Result } from "@/shared/http/errors";
import { openTenantStore } from "@/shared/db/env";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";
import {
  buildCityRouteContext,
  requirePermission,
} from "@/modules/identity/services/sessionService";

export async function listCampaigns(
  citySlug: string,
): Promise<Result<{ campaigns: { id: string; name: string; status: string }[] }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  const perm = requirePermission(built.ctx, "email.view");
  if (!perm.ok) return perm;

  const store = openTenantStore(built.ctx.tenant);
  const { emailCampaigns } = store.tables;
  const rows = await store.db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.orgId, store.orgId));
  return ok({
    campaigns: rows.map((r) => ({ id: r.id, name: r.name, status: r.status })),
  });
}

export async function listCampaignsPublic(
  citySlug: string,
): Promise<Result<{ count: number }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) return city;
  const store = openTenantStore(city.tenant);
  const { emailCampaigns } = store.tables;
  const rows = await store.db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.orgId, store.orgId));
  return ok({ count: rows.length });
}
