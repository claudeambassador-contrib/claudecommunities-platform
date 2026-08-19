import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as usersRepo from "@/modules/identity/repositories/usersRepository";
import { resolveCityContext } from "@/modules/tenants/services/publicListService";
import type { Actor } from "@/shared/auth/actor";
import { isClerkServerConfigured } from "@/shared/auth/clerk";
import { hasPermission, type Permission, permissionsForRole } from "@/shared/auth/permissions";
import type { RegistryDb } from "@/shared/db/client";
import { getRegistryDb, openTenantStore, workerEnv } from "@/shared/db/env";
import { err, ok, type Result } from "@/shared/http/errors";
import type { AuthContext, RouteContext, TenantContext } from "@/shared/http/routeContext";
import { newId } from "@/shared/ids";
import { ttlMemo } from "@/shared/ttlMemo";

/** 60s isolate cache: Clerk fetch + registry upsert per user, city row per slug.
 *  Role is always fresh per-request. Ban status and super-admin flag are now
 *  re-checked against the registry (D1) on every memo hit too — only the
 *  Clerk profile fetch + upsert are memoized 60s. City TenantContext can
 *  still be stale up to 60s. */
const sessionMemo = ttlMemo<AuthContext>(60_000);
const cityMemo = ttlMemo<TenantContext>(60_000);

export async function syncSessionUser(db: RegistryDb): Promise<Result<{ auth: AuthContext }>> {
  if (!isClerkServerConfigured(workerEnv())) {
    return err("unauthenticated", 401);
  }

  let session: Awaited<ReturnType<typeof auth>>;
  try {
    session = await auth();
  } catch {
    return err("unauthenticated", 401);
  }
  if (!(session.isAuthenticated && session.userId)) {
    return err("unauthenticated", 401);
  }

  const cached = sessionMemo.get(session.userId);
  if (cached) {
    const fresh = await usersRepo.findByClerkId(db, session.userId);
    if (fresh) {
      if (fresh.isBanned) {
        sessionMemo.delete(session.userId);
        return err("banned", 403);
      }
      return ok({ auth: { ...cached, isSuperAdmin: fresh.isSuperAdmin } });
    }
    // Row vanished since caching — fall through to the full re-sync path.
  }

  const clerkUser = await readClerkUser(session.userId);
  if (!clerkUser.ok) {
    return clerkUser;
  }
  const { clerk } = clerkUser;
  const email =
    clerk.primaryEmailAddress?.emailAddress ?? clerk.emailAddresses[0]?.emailAddress ?? "";
  if (!email) {
    return err("missing_email", 400);
  }

  const user = await usersRepo.upsertFromClerk(db, {
    clerkUserId: clerk.id,
    displayName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || clerk.username,
    email: email.toLowerCase(),
    id: newId("usr"),
    imageUrl: clerk.imageUrl ?? null,
    now: new Date(),
  });

  if (user.isBanned) {
    return err("banned", 403);
  }

  const authCtx: AuthContext = {
    clerkUserId: user.clerkUserId,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    permissions: permissionsForRole(null),
    role: null,
    userId: user.id,
  };
  sessionMemo.set(session.userId, authCtx);

  return ok({ auth: authCtx });
}

async function readClerkUser(userId: string) {
  try {
    const client = await clerkClient();
    return ok({ clerk: await client.users.getUser(userId) });
  } catch {
    return err("unauthenticated", 401);
  }
}

async function resolveTenant(
  registryDb: RegistryDb,
  citySlug: string,
): Promise<Result<{ tenant: TenantContext }>> {
  const cached = cityMemo.get(citySlug);
  if (cached) {
    return ok({ tenant: cached });
  }
  const city = await resolveCityContext(registryDb, citySlug);
  if (!city.ok) {
    return city;
  }
  cityMemo.set(citySlug, city.tenant);
  return ok({ tenant: city.tenant });
}

export async function buildCityRouteContext(
  citySlug: string,
): Promise<Result<{ ctx: RouteContext }>> {
  const registryDb = getRegistryDb();
  const resolvedTenant = await resolveTenant(registryDb, citySlug);
  if (!resolvedTenant.ok) {
    return resolvedTenant;
  }
  const { tenant } = resolvedTenant;

  const store = openTenantStore(tenant);
  const session = await syncSessionUser(registryDb);
  let authCtx: AuthContext | null = null;

  if (session.ok) {
    const membership = await usersRepo.findMembership(
      registryDb,
      session.auth.userId,
      tenant.orgId,
    );
    const role = membership?.role ?? null;
    authCtx = {
      ...session.auth,
      permissions: session.auth.isSuperAdmin
        ? permissionsForRole("owner")
        : permissionsForRole(role),
      role,
    };
  }

  return ok({
    ctx: {
      auth: authCtx,
      registryDb,
      tenant,
      tenantDb: store.db,
    },
  });
}

export function requirePermission(
  ctx: RouteContext,
  permission: Permission | Permission[],
): Result<{ auth: AuthContext }> {
  if (!ctx.auth) {
    return err("unauthenticated", 401);
  }
  if (!(hasPermission(ctx.auth.permissions, permission) || ctx.auth.isSuperAdmin)) {
    return err("forbidden", 403);
  }
  return ok({ auth: ctx.auth });
}

export function actorFromAuth(authCtx: AuthContext): Actor {
  return {
    email: authCtx.email,
    id: authCtx.userId,
    isSuperAdmin: authCtx.isSuperAdmin,
    permissions: authCtx.permissions,
  };
}

export function hasAnyAdminPermission(authCtx: AuthContext | null): boolean {
  if (!authCtx) {
    return false;
  }
  if (authCtx.isSuperAdmin) {
    return true;
  }
  return authCtx.permissions.size > 0;
}
