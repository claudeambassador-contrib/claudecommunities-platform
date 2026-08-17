import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import * as usersRepo from "@/modules/identity/repositories/usersRepository";
import { getRegistryDb, openTenantStore } from "@/shared/db/env";
import { permissionsForRole, hasPermission, type Permission } from "@/shared/auth/permissions";
import { err, ok, type Result } from "@/shared/http/errors";
import type { AuthContext, RouteContext, TenantContext } from "@/shared/http/routeContext";
import { newId } from "@/shared/ids";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";

export async function syncSessionUser(): Promise<Result<{ auth: AuthContext }>> {
  const session = await auth();
  if (!session.isAuthenticated || !session.userId) {
    return err("unauthenticated", 401);
  }

  const client = await clerkClient();
  const clerk = await client.users.getUser(session.userId);
  const email =
    clerk.primaryEmailAddress?.emailAddress ??
    clerk.emailAddresses[0]?.emailAddress ??
    "";
  if (!email) return err("missing_email", 400);

  const db = getRegistryDb();
  const user = await usersRepo.upsertFromClerk(db, {
    id: newId("usr"),
    clerkUserId: clerk.id,
    email: email.toLowerCase(),
    displayName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || clerk.username,
    imageUrl: clerk.imageUrl ?? null,
    now: new Date(),
  });

  if (user.isBanned) return err("banned", 403);

  return ok({
    auth: {
      userId: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      role: null,
      isSuperAdmin: user.isSuperAdmin,
      permissions: permissionsForRole(null),
    },
  });
}

export async function buildCityRouteContext(
  citySlug: string,
): Promise<Result<{ ctx: RouteContext }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) return city;

  const store = openTenantStore(city.tenant);
  const session = await syncSessionUser();
  let authCtx: AuthContext | null = null;

  if (session.ok) {
    const db = getRegistryDb();
    const membership = await usersRepo.findMembership(
      db,
      session.auth.userId,
      city.tenant.orgId,
    );
    const role = membership?.role ?? null;
    authCtx = {
      ...session.auth,
      role,
      permissions: session.auth.isSuperAdmin
        ? permissionsForRole("owner")
        : permissionsForRole(role),
    };
  }

  return ok({
    ctx: {
      registryDb: getRegistryDb(),
      tenantDb: store.db,
      tenant: city.tenant,
      auth: authCtx,
    },
  });
}

export function requirePermission(
  ctx: RouteContext,
  permission: Permission | Permission[],
): Result<{ auth: AuthContext }> {
  if (!ctx.auth) return err("unauthenticated", 401);
  if (!hasPermission(ctx.auth.permissions, permission) && !ctx.auth.isSuperAdmin) {
    return err("forbidden", 403);
  }
  return ok({ auth: ctx.auth });
}

export type { TenantContext };
