import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as usersRepo from "@/modules/identity/repositories/usersRepository";
import {
  type ClerkProfile,
  createSessionService,
  type SessionDeps,
} from "@/modules/identity/services/sessionCore";
import { provisionCity } from "@/modules/tenants/services/publicListService";
import { permissionsForRole } from "@/shared/auth/permissions";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { AuthContext, TenantContext } from "@/shared/http/routeContext";
import { newId } from "@/shared/ids";
import { ttlMemo } from "@/shared/ttlMemo";
import { openMemoryRegistry } from "../helpers/registry";
import { openMemoryTenant } from "../helpers/tenant";

const CLERK_ID = "user_clerk_1";

function profile(overrides: Partial<ClerkProfile> = {}): ClerkProfile {
  return {
    emailAddresses: [{ emailAddress: "Ada@Example.com" }],
    firstName: "Ada",
    id: CLERK_ID,
    imageUrl: "https://img.example.com/ada.png",
    lastName: "Lovelace",
    primaryEmailAddress: { emailAddress: "Ada@Example.com" },
    username: "ada",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<SessionDeps> = {}): SessionDeps {
  return {
    cityMemo: ttlMemo<TenantContext>(60_000),
    getProfile: vi.fn(async () => profile()),
    getSessionUserId: vi.fn(async () => CLERK_ID as string | null),
    isConfigured: () => true,
    openTenantStore: () => openMemoryTenant(),
    sessionMemo: ttlMemo<AuthContext>(60_000),
    ...overrides,
  };
}

async function seedCity(registry: RegistryStore, name = "Sydney") {
  const result = await provisionCity(registry.db, { name, slug: "sydney" });
  if (!result.ok) {
    throw new Error(`seedCity failed: ${result.error.code}`);
  }
  return result.tenant;
}

function setUserFlag(
  registry: RegistryStore,
  flags: { isBanned?: boolean; isSuperAdmin?: boolean },
) {
  return registry.db
    .update(registry.tables.users)
    .set(flags)
    .where(eq(registry.tables.users.clerkUserId, CLERK_ID));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sessionCore.syncSessionUser", () => {
  it("upserts the user on a fresh sign-in and returns member-level permissions", async () => {
    const registry = openMemoryRegistry();
    const service = createSessionService(makeDeps());

    const result = await service.syncSessionUser(registry.db);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.auth.clerkUserId).toBe(CLERK_ID);
    expect(result.auth.email).toBe("ada@example.com");
    expect(result.auth.isSuperAdmin).toBe(false);
    expect(result.auth.role).toBeNull();
    expect(result.auth.permissions).toEqual(permissionsForRole(null));

    const row = await usersRepo.findByClerkId(registry.db, CLERK_ID);
    expect(row?.displayName).toBe("Ada Lovelace");
  });

  it("rejects a banned user on a fresh sync and caches nothing", async () => {
    const registry = openMemoryRegistry();
    const deps = makeDeps();
    const service = createSessionService(deps);

    await service.syncSessionUser(registry.db);
    deps.sessionMemo.delete(CLERK_ID);
    await setUserFlag(registry, { isBanned: true });

    const result = await service.syncSessionUser(registry.db);

    expect(result).toEqual({
      error: { code: "banned", message: undefined, status: 403 },
      ok: false,
    });
    expect(deps.sessionMemo.get(CLERK_ID)).toBeUndefined();
  });

  it("rejects a banned user on a memo hit and evicts the memo entry", async () => {
    const registry = openMemoryRegistry();
    const deps = makeDeps();
    const service = createSessionService(deps);

    await service.syncSessionUser(registry.db);
    expect(deps.sessionMemo.get(CLERK_ID)).toBeDefined();

    await setUserFlag(registry, { isBanned: true });
    const banned = await service.syncSessionUser(registry.db);
    expect(banned.ok).toBe(false);
    expect(banned.ok === false && banned.error.code).toBe("banned");
    expect(deps.sessionMemo.get(CLERK_ID)).toBeUndefined();

    // Unbanning must now take the full re-sync path (Clerk is hit a second time).
    await setUserFlag(registry, { isBanned: false });
    const again = await service.syncSessionUser(registry.db);
    expect(again.ok).toBe(true);
    expect(deps.getProfile).toHaveBeenCalledTimes(2);
  });

  it("refreshes isSuperAdmin from the registry on a memo hit", async () => {
    const registry = openMemoryRegistry();
    const deps = makeDeps();
    const service = createSessionService(deps);

    const first = await service.syncSessionUser(registry.db);
    expect(first.ok && first.auth.isSuperAdmin).toBe(false);

    await setUserFlag(registry, { isSuperAdmin: true });
    const second = await service.syncSessionUser(registry.db);

    expect(second.ok && second.auth.isSuperAdmin).toBe(true);
    expect(deps.getProfile).toHaveBeenCalledTimes(1);
  });

  it("falls through to a full re-sync when the registry row vanished after caching", async () => {
    const registry = openMemoryRegistry();
    const deps = makeDeps();
    const service = createSessionService(deps);

    await service.syncSessionUser(registry.db);
    await registry.db
      .delete(registry.tables.users)
      .where(eq(registry.tables.users.clerkUserId, CLERK_ID));

    const result = await service.syncSessionUser(registry.db);

    expect(result.ok).toBe(true);
    expect(deps.getProfile).toHaveBeenCalledTimes(2);
    expect(await usersRepo.findByClerkId(registry.db, CLERK_ID)).not.toBeNull();
  });

  it("returns unauthenticated without touching the session when Clerk is not configured", async () => {
    const registry = openMemoryRegistry();
    const deps = makeDeps({ isConfigured: () => false });
    const service = createSessionService(deps);

    const result = await service.syncSessionUser(registry.db);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toEqual({
      code: "unauthenticated",
      message: undefined,
      status: 401,
    });
    expect(deps.getSessionUserId).not.toHaveBeenCalled();
  });

  it("returns missing_email when the Clerk profile has no email address", async () => {
    const registry = openMemoryRegistry();
    const service = createSessionService(
      makeDeps({
        getProfile: async () => profile({ emailAddresses: [], primaryEmailAddress: null }),
      }),
    );

    const result = await service.syncSessionUser(registry.db);

    expect(result.ok === false && result.error).toEqual({
      code: "missing_email",
      message: undefined,
      status: 400,
    });
    expect(await usersRepo.findByClerkId(registry.db, CLERK_ID)).toBeNull();
  });

  it("re-syncs from Clerk once the session memo TTL has expired", async () => {
    vi.useFakeTimers();
    const registry = openMemoryRegistry();
    const deps = makeDeps();
    const service = createSessionService(deps);

    await service.syncSessionUser(registry.db);
    await service.syncSessionUser(registry.db);
    expect(deps.getProfile).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    const result = await service.syncSessionUser(registry.db);

    expect(result.ok).toBe(true);
    expect(deps.getProfile).toHaveBeenCalledTimes(2);
  });
});

describe("sessionCore.buildCityRouteContext", () => {
  it("maps membership role and super-admin to permissions, and no session to a null auth", async () => {
    const registry = openMemoryRegistry();
    const tenant = await seedCity(registry);
    const deps = makeDeps();
    const service = createSessionService(deps);

    const synced = await service.syncSessionUser(registry.db);
    expect(synced.ok).toBe(true);
    if (!synced.ok) {
      return;
    }
    await usersRepo.ensureMembership(registry.db, {
      id: newId("mem"),
      now: new Date(),
      orgId: tenant.orgId,
      role: "member",
      userId: synced.auth.userId,
    });

    const asMember = await service.buildCityRouteContext(registry.db, "sydney");
    expect(asMember.ok).toBe(true);
    if (!asMember.ok) {
      return;
    }
    expect(asMember.ctx.tenant.slug).toBe("sydney");
    expect(asMember.ctx.auth?.role).toBe("member");
    expect(asMember.ctx.auth?.permissions).toEqual(permissionsForRole("member"));

    await setUserFlag(registry, { isSuperAdmin: true });
    const asSuperAdmin = await service.buildCityRouteContext(registry.db, "sydney");
    expect(asSuperAdmin.ok && asSuperAdmin.ctx.auth?.permissions).toEqual(
      permissionsForRole("owner"),
    );

    const anonymous = createSessionService(makeDeps({ getSessionUserId: async () => null }));
    const asGuest = await anonymous.buildCityRouteContext(registry.db, "sydney");
    expect(asGuest.ok).toBe(true);
    expect(asGuest.ok && asGuest.ctx.auth).toBeNull();
    expect(asGuest.ok && asGuest.ctx.tenant.slug).toBe("sydney");
  });

  it("serves a stale tenant name inside the city memo TTL and a fresh one after it", async () => {
    vi.useFakeTimers();
    const registry = openMemoryRegistry();
    const tenant = await seedCity(registry, "Sydney");
    const service = createSessionService(makeDeps({ getSessionUserId: async () => null }));

    const first = await service.buildCityRouteContext(registry.db, "sydney");
    expect(first.ok && first.ctx.tenant.name).toBe("Sydney");

    await registry.db
      .update(registry.tables.tenants)
      .set({ name: "Sydney Renamed" })
      .where(eq(registry.tables.tenants.id, tenant.id));

    const cached = await service.buildCityRouteContext(registry.db, "sydney");
    expect(cached.ok && cached.ctx.tenant.name).toBe("Sydney");

    vi.advanceTimersByTime(61_000);
    const fresh = await service.buildCityRouteContext(registry.db, "sydney");
    expect(fresh.ok && fresh.ctx.tenant.name).toBe("Sydney Renamed");
  });
});
