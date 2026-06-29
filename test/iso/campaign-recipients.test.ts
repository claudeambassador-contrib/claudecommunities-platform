import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { freshDb, seedTenant, seedUser } from "./helpers";

/**
 * B3c — the campaign-send recipient leak fix.
 *
 * queryRecipients() resolves email recipients off the GLOBAL User table. The
 * chokepoint does NOT auto-scope User (a person belongs to many communities),
 * so the fix adds an explicit membership join —
 *   `tenantMemberships: { some: { tenantId } }`
 * — restricting recipients to the campaign's tenant. WITHOUT it, a campaign in
 * one community would email every community's users.
 *
 * queryRecipients itself calls getPlatformPrisma (needs a CloudflareEnv, absent
 * in vitest), so this property-tests the exact where-clause on the base client.
 * Each positive assertion is paired with the unfiltered query to prove the join
 * is load-bearing (it actually excludes the other tenant's members). The
 * workflow run() ALS wiring is verified structurally, not here.
 */
describe("B3c campaign recipient membership scoping", () => {
  let db: ReturnType<typeof freshDb>;
  beforeEach(() => {
    db = freshDb();
  });
  afterEach(() => db.cleanup());

  it("the membership join restricts recipients to the campaign's tenant", async () => {
    const { base } = db;
    await seedUser(base, "u1", "u1@example.com");
    await seedUser(base, "u2", "u2@example.com");
    await seedUser(base, "u3", "u3@example.com");
    // u1 ∈ tenant a (owner), u2 ∈ tenant b, u3 ∈ BOTH.
    await seedTenant(base, "a", "u1");
    await seedTenant(base, "b", "u2");
    await base.userTenant.create({ data: { tenantId: "a", userId: "u3", role: "member" } });
    await base.userTenant.create({ data: { tenantId: "b", userId: "u3", role: "member" } });

    // The leak-fix where-clause for a campaign in tenant "a" (no segment).
    const recipientsA = await base.user.findMany({
      where: {
        email: { not: null },
        isBanned: false,
        tenantMemberships: { some: { tenantId: "a" } },
      },
      select: { id: true },
    });
    expect(recipientsA.map((r) => r.id).sort()).toEqual(["u1", "u3"]);

    // Paired UNFILTERED query — proves the join is load-bearing: without it the
    // same campaign would also reach u2, a member of a DIFFERENT community.
    const unscoped = await base.user.findMany({
      where: { email: { not: null }, isBanned: false },
      select: { id: true },
    });
    expect(unscoped.map((r) => r.id).sort()).toEqual(["u1", "u2", "u3"]);
    expect(unscoped.map((r) => r.id)).toContain("u2");
  });

  it("a segment filter composes with the membership join (AND, within-tenant)", async () => {
    const { base } = db;
    await seedUser(base, "u1", "u1@example.com");
    await seedUser(base, "u2", "u2@example.com");
    await seedTenant(base, "a", "u1");
    await seedTenant(base, "b", "u2");
    // Both are global "admin" role, but in different tenants.
    await base.user.update({ where: { id: "u1" }, data: { role: "admin" } });
    await base.user.update({ where: { id: "u2" }, data: { role: "admin" } });

    // Segment {roles:["admin"]} for a campaign in tenant "a" → only u1: u2 is an
    // admin too but belongs to tenant b, so the membership join excludes it.
    const recipients = await base.user.findMany({
      where: {
        email: { not: null },
        isBanned: false,
        role: { in: ["admin"] },
        tenantMemberships: { some: { tenantId: "a" } },
      },
      select: { id: true },
    });
    expect(recipients.map((r) => r.id)).toEqual(["u1"]);
  });
});
