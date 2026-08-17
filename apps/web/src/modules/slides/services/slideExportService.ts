import { eq } from "drizzle-orm";
import { ok, type Result } from "@/shared/http/errors";
import { openTenantStore } from "@/shared/db/env";
import {
  buildCityRouteContext,
  requirePermission,
} from "@/modules/identity/services/sessionService";

export async function listExportJobs(
  citySlug: string,
): Promise<Result<{ jobs: { id: string; status: string }[] }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  const perm = requirePermission(built.ctx, "tools.use");
  if (!perm.ok) return perm;

  const store = openTenantStore(built.ctx.tenant);
  const { slideExportJobs } = store.tables;
  const rows = await store.db
    .select()
    .from(slideExportJobs)
    .where(eq(slideExportJobs.orgId, store.orgId));
  return ok({ jobs: rows.map((r) => ({ id: r.id, status: r.status })) });
}
