import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { d, freshDb, scoped, seedTenant, seedUser } from "./helpers";

// Probe: does a nested `connect` to a FOREIGN-tenant row link across tenants?
// The extension fires on the top-level op only; a nested connect sets an FK
// with no NOT NULL net. (Advisor #1.)
describe("nested connect — cross-tenant IDOR probe", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  let A: ReturnType<typeof scoped>;
  let B: ReturnType<typeof scoped>;
  let spaceA: { id: string };
  let spaceB: { id: string };
  let u1: { id: string };

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    A = scoped(base, "alpha");
    B = scoped(base, "beta");
    u1 = await seedUser(base, "u1", "u1@x.com");
    const u2 = await seedUser(base, "u2", "u2@x.com");
    await seedTenant(base, "alpha", u1.id);
    await seedTenant(base, "beta", u2.id);
    spaceA = await A.space.create({ data: d({ name: "A", slug: "a" }) });
    spaceB = await B.space.create({ data: d({ name: "B", slug: "b" }) });
  });
  afterAll(() => cleanup());

  it("update: connect A's post to B's space must NOT link across tenants", async () => {
    const post = await A.post.create({
      data: d({ content: "p", space: { connect: { id: spaceA.id } }, author: { connect: { id: u1.id } } }),
    });
    // Attack: re-parent the post onto BETA's space from the ALPHA client.
    let linked = false;
    try {
      await A.post.update({ where: { id: post.id }, data: { space: { connect: { id: spaceB.id } } } });
      linked = true;
    } catch {
      /* a P2025 here = the fix is working */
    }
    const after = await base.post.findUnique({ where: { id: post.id }, include: { space: true } });
    // SECURE expectation: the post still points at A's space (B was unreachable).
    expect(
      after?.spaceId,
      `nested connect linked across tenants (linked=${linked}, space.tenantId=${after?.space?.tenantId})`,
    ).toBe(spaceA.id);
  });

  it("create: connectOrCreate connecting to B's space must NOT attach B's row", async () => {
    let createdPostId: string | undefined;
    try {
      const p = await A.post.create({
        data: d({
          content: "coc",
          author: { connect: { id: u1.id } },
          space: {
            connectOrCreate: {
              where: { id: spaceB.id },
              create: d({ name: "new", slug: "coc-new" }),
            },
          },
        }),
      });
      createdPostId = p.id;
    } catch {
      /* throwing is an acceptable secure outcome */
    }
    if (createdPostId) {
      const after = await base.post.findUnique({ where: { id: createdPostId }, include: { space: true } });
      expect(after?.space?.tenantId, "connectOrCreate attached a foreign-tenant space").not.toBe("beta");
    }
  });
});
