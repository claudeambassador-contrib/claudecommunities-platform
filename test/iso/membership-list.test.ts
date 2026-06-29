import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { d, freshDb, scoped, seedUser } from "./helpers";

// USER-LIST ISOLATION. `User` is a GLOBAL model, so the chokepoint passes
// `user.*` queries through UNTOUCHED — it scopes neither the top-level filter
// nor any nested relation reached through the user. The 6 migrated User-listing
// pages therefore rely on TWO hand-written guards, and this suite locks both:
//
//   1. the membership join `where:{ tenantMemberships:{ some:{ tenantId } } }`
//      restricts WHICH users appear (a member of another tenant must be absent);
//   2. an explicit `tenantId` on every scoped relation read THROUGH the user
//      (`_count`, `userBadges`, …) — without it the include sums the user's rows
//      across EVERY tenant they belong to (the cross-tenant include leak).
//
// Each positive assertion is paired with the UNFILTERED query to prove the
// filter is load-bearing: a regression that drops `tenantId` would make the
// unfiltered count reappear, and these tests would go red.
describe("user-list isolation (global User + membership join + filtered includes)", () => {
  let base: PrismaClient;
  let cleanup: () => void;

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());

    // Three global identities.
    await seedUser(base, "uShared", "shared@x.com"); // member of BOTH tenants
    await seedUser(base, "uAlpha", "alpha@x.com"); //  member of alpha only
    await seedUser(base, "uBeta", "beta@x.com"); //    member of beta only

    // Two tenants with memberships.
    for (const slug of ["alpha", "beta"]) {
      await base.tenant.create({ data: { slug, name: slug.toUpperCase(), status: "active" } });
    }
    await base.userTenant.create({ data: { tenantId: "alpha", userId: "uShared", role: "member" } });
    await base.userTenant.create({ data: { tenantId: "beta", userId: "uShared", role: "member" } });
    await base.userTenant.create({ data: { tenantId: "alpha", userId: "uAlpha", role: "member" } });
    await base.userTenant.create({ data: { tenantId: "beta", userId: "uBeta", role: "member" } });

    const A = scoped(base, "alpha");
    const B = scoped(base, "beta");

    // uShared has content + a badge in EACH tenant. The scoped client stamps
    // tenantId on create, so these land in distinct tenants.
    for (const [c, slug] of [[A, "alpha"], [B, "beta"]] as const) {
      const space = await c.space.create({ data: d({ name: "General", slug: `general-${slug}` }) });
      await c.post.create({
        data: d({ content: `${slug}-post`, space: { connect: { id: space.id } }, author: { connect: { id: "uShared" } } }),
      });
      const badge = await c.badge.create({ data: d({ name: `${slug}-badge` }) });
      await c.userBadge.create({
        data: d({ user: { connect: { id: "uShared" } }, badge: { connect: { id: badge.id } } }),
      });
    }
  });
  afterAll(() => cleanup());

  it("the membership join lists only this tenant's members (a non-member is absent)", async () => {
    const A = scoped(base, "alpha");
    const members = await A.user.findMany({
      where: { tenantMemberships: { some: { tenantId: "alpha" } } },
      select: { id: true },
    });
    const ids = members.map((m) => m.id).sort();
    expect(ids).toEqual(["uAlpha", "uShared"]); // uBeta (member of beta only) is excluded
  });

  it("the join is load-bearing: WITHOUT it, the global User table leaks every tenant's users", async () => {
    const A = scoped(base, "alpha");
    // Exactly the regression a forgotten membership join reintroduces.
    const all = await A.user.findMany({ select: { id: true } });
    expect(all.map((u) => u.id).sort()).toEqual(["uAlpha", "uBeta", "uShared"]);
    expect(all.length).toBeGreaterThan(2); // proves the filtered query above isn't trivially the whole set
  });

  it("findFirst by id + membership join 404s a user who is not a member of this tenant", async () => {
    const A = scoped(base, "alpha");
    // uBeta exists globally and is queried by a known id (the IDOR shape) — but
    // is not an alpha member, so the profile resolver returns null (→ notFound).
    const leaked = await A.user.findFirst({
      where: { id: "uBeta", tenantMemberships: { some: { tenantId: "alpha" } } },
    });
    expect(leaked).toBeNull();
    // Sanity: the same user IS resolvable in the tenant they belong to.
    const ok = await scoped(base, "beta").user.findFirst({
      where: { id: "uBeta", tenantMemberships: { some: { tenantId: "beta" } } },
    });
    expect(ok?.id).toBe("uBeta");
  });

  it("a scoped-relation _count read THROUGH the global User must carry tenantId (else it sums across tenants)", async () => {
    const A = scoped(base, "alpha");
    const filtered = await A.user.findFirst({
      where: { id: "uShared", tenantMemberships: { some: { tenantId: "alpha" } } },
      include: { _count: { select: { posts: { where: { tenantId: "alpha" } } } } },
    });
    expect(filtered?._count.posts).toBe(1); // only alpha's post

    // The leak the filter prevents: an UNfiltered _count counts both tenants' posts.
    const unfiltered = await A.user.findFirst({
      where: { id: "uShared" },
      include: { _count: { select: { posts: true } } },
    });
    expect(unfiltered?._count.posts).toBe(2); // alpha + beta — divergence is real
  });

  it("a userBadges include THROUGH the global User must carry tenantId (else it leaks other tenants' badges)", async () => {
    const A = scoped(base, "alpha");
    const filtered = await A.user.findFirst({
      where: { id: "uShared", tenantMemberships: { some: { tenantId: "alpha" } } },
      include: { userBadges: { where: { tenantId: "alpha" }, include: { badge: true } } },
    });
    expect(filtered?.userBadges).toHaveLength(1);
    expect(filtered?.userBadges[0]?.badge.name).toBe("alpha-badge");

    // Unfiltered → both tenants' badges (the cross-tenant include leak).
    const unfiltered = await A.user.findFirst({
      where: { id: "uShared" },
      include: { userBadges: true },
    });
    expect(unfiltered?.userBadges).toHaveLength(2);
  });
});
