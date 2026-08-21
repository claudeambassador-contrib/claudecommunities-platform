// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as usersRepo from "@/modules/identity/repositories/usersRepository";
import { resolveCityContext } from "@/modules/tenants/services/publicListService";
import type { Actor } from "@/shared/auth/actor";
import { hasPermission, permissionsForRole } from "@/shared/auth/permissions";
import type { Permission } from "@/shared/auth/permissions";
import type { RegistryDb } from "@/shared/db/client";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
import type { AuthContext, RouteContext, TenantContext } from "@/shared/http/routeContext";
import { newId } from "@/shared/ids";
import type { ttlMemo } from "@/shared/ttlMemo";

/** The slice of a Clerk user the session sync actually reads. */
export interface ClerkProfile {
  emailAddresses: { emailAddress: string }[];
  firstName: string | null;
  id: string;
  imageUrl: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  username: string | null;
}

export interface SessionDeps {
  cityMemo: ReturnType<typeof ttlMemo<TenantContext>>;
  /** null = Clerk unavailable or user fetch failed → treat as unauthenticated. */
  getProfile: (userId: string) => Promise<ClerkProfile | null>;
  /** null = no signed-in session. Wraps Clerk's auth(); must never throw. */
  getSessionUserId: () => Promise<string | null>;
  isConfigured: () => boolean;
  openTenantStore: (tenant: TenantContext) => TenantStore;
  sessionMemo: ReturnType<typeof ttlMemo<AuthContext>>;
}

export interface SessionService {
  buildCityRouteContext: (
    registryDb: RegistryDb,
    citySlug: string,
  ) => Promise<Result<{ ctx: RouteContext }>>;
  syncSessionUser: (db: RegistryDb) => Promise<Result<{ auth: AuthContext }>>;
}

/**
 * Session logic with every ambient dependency injected: Clerk access, the
 * tenant-store opener, and both TTL memos. `sessionService.ts` supplies the
 * production wiring; tests supply in-memory stand-ins.
 *
 * Role is always fresh per-request. Ban status and the super-admin flag are
 * re-checked against the registry on every memo hit too — only the Clerk
 * profile fetch + upsert are memoized. A city `TenantContext` can still be
 * stale for the lifetime of `cityMemo`'s TTL.
 */
export function createSessionService(deps: SessionDeps): SessionService {
  async function readClerkUser(userId: string): Promise<Result<{ clerk: ClerkProfile }>> {
    const clerk = await deps.getProfile(userId);
    if (!clerk) {
      return err("unauthenticated", 401);
    }
    return ok({ clerk });
  }

  /**
   * Memo-hit path. Returns null when the caller must fall through to the full
   * re-sync: no cache entry, or the registry row vanished since caching.
   */
  async function replayCachedSession(
    db: RegistryDb,
    sessionUserId: string,
  ): Promise<Result<{ auth: AuthContext }> | null> {
    const cached = deps.sessionMemo.get(sessionUserId);
    if (!cached) {
      return null;
    }
    const fresh = await usersRepo.findByClerkId(db, sessionUserId);
    if (!fresh) {
      return null;
    }
    if (fresh.isBanned) {
      deps.sessionMemo.delete(sessionUserId);
      return err("banned", 403);
    }
    return ok({ auth: { ...cached, isSuperAdmin: fresh.isSuperAdmin } });
  }

  async function syncSessionUser(db: RegistryDb): Promise<Result<{ auth: AuthContext }>> {
    if (!deps.isConfigured()) {
      return err("unauthenticated", 401);
    }

    const sessionUserId = await deps.getSessionUserId();
    if (!sessionUserId) {
      return err("unauthenticated", 401);
    }

    const replayed = await replayCachedSession(db, sessionUserId);
    if (replayed) {
      return replayed;
    }

    const clerkUser = await readClerkUser(sessionUserId);
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
    deps.sessionMemo.set(sessionUserId, authCtx);

    return ok({ auth: authCtx });
  }

  async function resolveTenant(
    registryDb: RegistryDb,
    citySlug: string,
  ): Promise<Result<{ tenant: TenantContext }>> {
    const cached = deps.cityMemo.get(citySlug);
    if (cached) {
      return ok({ tenant: cached });
    }
    const city = await resolveCityContext(registryDb, citySlug);
    if (!city.ok) {
      return city;
    }
    deps.cityMemo.set(citySlug, city.tenant);
    return ok({ tenant: city.tenant });
  }

  async function buildCityRouteContext(
    registryDb: RegistryDb,
    citySlug: string,
  ): Promise<Result<{ ctx: RouteContext }>> {
    // Tenant resolution and session sync are independent — run them in parallel
    // to cut one sequential round-trip per server fn.
    const [resolvedTenant, session] = await Promise.all([
      resolveTenant(registryDb, citySlug),
      syncSessionUser(registryDb),
    ]);
    if (!resolvedTenant.ok) {
      return resolvedTenant;
    }
    const { tenant } = resolvedTenant;

    const store = deps.openTenantStore(tenant);
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

  return { buildCityRouteContext, syncSessionUser };
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
