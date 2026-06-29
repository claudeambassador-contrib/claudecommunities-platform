import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapHomeTenant } from "@/lib/services/tenants";
import { freshDb } from "./helpers";

// Empirically verify the AU home-tenant bootstrap (the prerequisite for
// membership-based authz + User-list scoping): it enrolls every existing user,
// the membership join resolves them through the generated Prisma client, roles
// are preserved, timestamps deserialize, and it is idempotent.
describe("bootstrapHomeTenant (existing single-tenant → tenant model)", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  let result: Awaited<ReturnType<typeof bootstrapHomeTenant>>;

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    await base.user.create({ data: { id: "u_admin", clerkId: "c1", email: "a@x.com", name: "A", role: "admin" } });
    await base.user.create({ data: { id: "u_mem1", clerkId: "c2", email: "b@x.com", name: "B", role: "member" } });
    await base.user.create({ data: { id: "u_mem2", clerkId: "c3", email: "c@x.com", name: "C", role: "member" } });
    result = await bootstrapHomeTenant(base, { slug: "au", name: "Claude Community Australia", gaId: "G-AU" });
  });
  afterAll(() => cleanup());

  it("creates the registry + settings rows", async () => {
    expect(result.tenantCreated).toBe(true);
    expect(result.totalUsers).toBe(3);
    expect(result.membershipsBackfilled).toBe(3);
    expect((await base.tenant.findUnique({ where: { slug: "au" } }))?.name).toBe("Claude Community Australia");
    expect((await base.tenantSetting.findUnique({ where: { tenantId: "au" } }))?.gaId).toBe("G-AU");
  });

  it("ensures the canonical per-tenant system roles", async () => {
    const roles = await base.role.findMany({ where: { tenantId: "au" } });
    expect(roles.map((r) => r.name).sort()).toEqual(["admin", "member", "super_admin"]);
  });

  it("enrolls EVERY user with their global role preserved, timestamps valid", async () => {
    const memberships = await base.userTenant.findMany({ where: { tenantId: "au" }, orderBy: { userId: "asc" } });
    expect(memberships.map((m) => [m.userId, m.role])).toEqual([
      ["u_admin", "admin"],
      ["u_mem1", "member"],
      ["u_mem2", "member"],
    ]);
    // timestamps deserialize through the generated client (no Invalid Date) —
    // the concern the raw-SQL path would have raised, sidestepped by writing via Prisma.
    for (const m of memberships) {
      expect(m.createdAt).toBeInstanceOf(Date);
      expect(Number.isNaN(m.createdAt.getTime())).toBe(false);
    }
  });

  it("the membership join resolves exactly the enrolled users", async () => {
    const members = await base.user.findMany({
      where: { tenantMemberships: { some: { tenantId: "au" } } },
      select: { id: true },
    });
    expect(members.map((u) => u.id).sort()).toEqual(["u_admin", "u_mem1", "u_mem2"]);
  });

  it("a user added AFTER the bootstrap is excluded from the join (membership is the filter)", async () => {
    await base.user.create({ data: { id: "u_late", clerkId: "c9", email: "d@x.com", name: "D", role: "member" } });
    const members = await base.user.findMany({
      where: { tenantMemberships: { some: { tenantId: "au" } } },
      select: { id: true },
    });
    expect(members.map((u) => u.id)).not.toContain("u_late");
  });

  it("is idempotent — re-running backfills nothing new", async () => {
    const rerun = await bootstrapHomeTenant(base, { slug: "au", name: "Claude Community Australia" });
    expect(rerun.tenantCreated).toBe(false);
    // u_late exists now but was never enrolled, so a re-run enrolls exactly it.
    expect(rerun.membershipsBackfilled).toBe(1);
    expect(rerun.totalUsers).toBe(4);
  });

  it("rejects an invalid/reserved slug", async () => {
    await expect(bootstrapHomeTenant(base, { slug: "api", name: "x" })).rejects.toThrow();
  });
});
