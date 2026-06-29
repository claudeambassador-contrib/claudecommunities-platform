import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { freshDb, scoped, seedUser } from "./helpers";

/**
 * B3c — the weekly-digest "new members" stat isolation.
 *
 * The digest's stats block counted new members with a GLOBAL `user.count` —
 * which would have shown every community the platform-wide signup number. The
 * fix counts scoped `userTenant.count` (memberships = people who JOINED this
 * community this week). This locks that the scoped count excludes other
 * tenants' joins, paired with the unscoped count to prove it's load-bearing.
 */
describe("B3c digest new-members stat scoping", () => {
  let db: ReturnType<typeof freshDb>;
  beforeEach(() => {
    db = freshDb();
  });
  afterEach(() => db.cleanup());

  it("counts only this tenant's joins this week (scoped userTenant.count)", async () => {
    const { base } = db;
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday → within the week
    await seedUser(base, "u1", "u1@example.com");
    await seedUser(base, "u2", "u2@example.com");
    await seedUser(base, "u3", "u3@example.com");
    await base.tenant.create({ data: { slug: "a", name: "A", status: "active" } });
    await base.tenant.create({ data: { slug: "b", name: "B", status: "active" } });
    // 1 person joined tenant a this week; 2 joined tenant b this week.
    await base.userTenant.create({
      data: { tenantId: "a", userId: "u1", role: "member", createdAt: recent },
    });
    await base.userTenant.create({
      data: { tenantId: "b", userId: "u2", role: "member", createdAt: recent },
    });
    await base.userTenant.create({
      data: { tenantId: "b", userId: "u3", role: "member", createdAt: recent },
    });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // The digest's scoped new-members count for tenant a → just its own join.
    const newMembersA = await scoped(base, "a").userTenant.count({
      where: { createdAt: { gte: oneWeekAgo } },
    });
    expect(newMembersA).toBe(1);

    // Paired unscoped count = 3 — the cross-tenant stat the scope closes (this
    // is the number the old global user.count would have leaked into a's digest).
    const globalCount = await base.userTenant.count({ where: { createdAt: { gte: oneWeekAgo } } });
    expect(globalCount).toBe(3);
  });
});
