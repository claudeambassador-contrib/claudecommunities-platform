import { and, eq } from "drizzle-orm";
import { ok, type Result } from "@/shared/http/errors";
import { openTenantStore } from "@/shared/db/env";
import {
  buildCityRouteContext,
  requirePermission,
} from "@/modules/identity/services/sessionService";

export async function listSocialPosts(
  citySlug: string,
): Promise<Result<{ posts: { id: string; status: string; body: string }[] }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  const perm = requirePermission(built.ctx, "social.view");
  if (!perm.ok) return perm;

  const store = openTenantStore(built.ctx.tenant);
  const { socialPosts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.orgId, store.orgId));
  return ok({
    posts: rows.map((r) => ({ id: r.id, status: r.status, body: r.body })),
  });
}

export async function countScheduled(citySlug: string): Promise<Result<{ count: number }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  const store = openTenantStore(built.ctx.tenant);
  const { socialPosts } = store.tables;
  const rows = await store.db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.orgId, store.orgId), eq(socialPosts.status, "scheduled")));
  return ok({ count: rows.length });
}
