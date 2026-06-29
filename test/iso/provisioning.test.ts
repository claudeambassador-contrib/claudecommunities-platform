import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTenant, setTenantStatus } from "@/lib/services/tenants";
import { freshDb, scoped, seedUser } from "./helpers";

// End-to-end: provisioning + per-tenant roles + membership + the chokepoint all
// working together. Proves Option A's "a tenant is a DB insert" with isolation.
describe("tenant provisioning (Option A end-to-end)", () => {
  let base: PrismaClient;
  let cleanup: () => void;

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    await seedUser(base, "owner_a", "a@x.com");
    await seedUser(base, "owner_b", "b@x.com");
    await provisionTenant(base, { slug: "alpha", name: "Alpha", ownerUserId: "owner_a", gaId: "G-AAA" });
    await provisionTenant(base, { slug: "beta", name: "Beta", ownerUserId: "owner_b" });
  });
  afterAll(() => cleanup());

  it("creates the registry rows", async () => {
    expect((await base.tenant.findUnique({ where: { slug: "alpha" } }))?.name).toBe("Alpha");
    expect((await base.tenantSetting.findUnique({ where: { tenantId: "alpha" } }))?.gaId).toBe("G-AAA");
  });

  it("both tenants get their OWN 'member' role (per-tenant Role PK, no collision)", async () => {
    const A = scoped(base, "alpha");
    const B = scoped(base, "beta");
    const aRoles = await A.role.findMany();
    const bRoles = await B.role.findMany();
    expect(aRoles.map((r) => r.name).sort()).toEqual(["admin", "member", "super_admin"]);
    expect(bRoles.map((r) => r.name).sort()).toEqual(["admin", "member", "super_admin"]);
    expect(aRoles.every((r) => r.tenantId === "alpha")).toBe(true);
    expect(bRoles.every((r) => r.tenantId === "beta")).toBe(true);
  });

  it("role lookup by name is tenant-scoped (the getRolePermissions path)", async () => {
    const A = scoped(base, "alpha");
    // findFirst by name → tenantId auto-injected → alpha's admin only
    const adminA = await A.role.findFirst({ where: { name: "admin" } });
    expect(adminA?.tenantId).toBe("alpha");
    expect(JSON.parse(adminA?.permissions ?? "[]").length).toBeGreaterThan(0);
    const memberA = await A.role.findFirst({ where: { name: "member" } });
    expect(JSON.parse(memberA?.permissions ?? "[]")).toEqual([]);
  });

  it("creator membership: super_admin (a SEEDED role, so it resolves to real perms) + tenant-scoped", async () => {
    const A = scoped(base, "alpha");
    const B = scoped(base, "beta");
    // super_admin, NOT "owner" — "owner" has no seeded Role row → would be 0 perms.
    const membership = await A.userTenant.findFirst({ where: { userId: "owner_a" } });
    expect(membership?.role).toBe("super_admin");
    // and the role actually resolves to permissions (the bug "owner" would have hidden)
    const role = await A.role.findFirst({ where: { name: membership?.role } });
    expect(JSON.parse(role?.permissions ?? "[]").length).toBeGreaterThan(0);
    // owner_a is NOT a member of beta → null on a beta URL (no cross-tenant authority)
    expect(await B.userTenant.findFirst({ where: { userId: "owner_a" } })).toBeNull();
  });

  it("seeds default spaces + leaderboard levels, tenant-scoped to the new tenant", async () => {
    const A = scoped(base, "alpha");
    const B = scoped(base, "beta");
    // 6 starter spaces + 9 levels per tenant, each carrying its own tenantId.
    expect(await A.space.count()).toBe(6);
    expect(await A.leaderboardLevel.count()).toBe(9);
    expect((await A.space.findMany()).every((s) => s.tenantId === "alpha")).toBe(true);
    // Isolation: beta has its OWN copy (same slugs, different tenant) — no overlap.
    expect(await B.space.count()).toBe(6);
    expect((await B.leaderboardLevel.findMany()).every((l) => l.tenantId === "beta")).toBe(true);
  });

  it("rejects invalid and duplicate slugs", async () => {
    await expect(provisionTenant(base, { slug: "api", name: "x", ownerUserId: "owner_a" })).rejects.toThrow();
    await expect(provisionTenant(base, { slug: "alpha", name: "dup", ownerUserId: "owner_a" })).rejects.toThrow();
  });

  it("setTenantStatus toggles suspension", async () => {
    await setTenantStatus(base, "beta", "suspended");
    expect((await base.tenant.findUnique({ where: { slug: "beta" } }))?.status).toBe("suspended");
    await setTenantStatus(base, "beta", "active");
  });
});
