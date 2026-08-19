import { actorFromAuth, buildCityRouteContext } from "@/modules/identity/services/sessionService";
import type { Actor } from "@/shared/auth/actor";
import { getRegistryStore, openTenantStore } from "@/shared/db/env";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import type { AuthContext, RouteContext, TenantContext } from "@/shared/http/routeContext";

export interface CityPageContext {
  actor: Actor | null;
  auth: AuthContext | null;
  ctx: RouteContext;
  registry: RegistryStore;
  store: TenantStore;
  tenant: TenantContext;
}

export async function loadCityPage(citySlug: string): Promise<Result<CityPageContext>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) {
    return built;
  }
  const { ctx } = built;
  return ok({
    actor: ctx.auth ? actorFromAuth(ctx.auth) : null,
    auth: ctx.auth,
    ctx,
    registry: getRegistryStore(),
    store: openTenantStore(ctx.tenant),
    tenant: ctx.tenant,
  });
}

export async function requireCityActor(
  citySlug: string,
): Promise<Result<CityPageContext & { actor: Actor }>> {
  const page = await loadCityPage(citySlug);
  if (!page.ok) {
    return page;
  }
  if (!page.actor) {
    return err("unauthenticated", 401, "Sign in required");
  }
  return ok({ ...page, actor: page.actor });
}
