import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { d, freshDb, scoped, seedTenant, seedUser } from "./helpers";

// Does injecting tenantId into a nested connect.where close the hole?
describe("connect fix mechanism probe", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  let spaceA: { id: string };
  let spaceB: { id: string };
  let u1: { id: string };

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    const A = scoped(base, "alpha");
    const B = scoped(base, "beta");
    u1 = await seedUser(base, "u1", "u1@x.com");
    const u2 = await seedUser(base, "u2", "u2@x.com");
    await seedTenant(base, "alpha", u1.id);
    await seedTenant(base, "beta", u2.id);
    spaceA = await A.space.create({ data: d({ name: "A", slug: "a" }) });
    spaceB = await B.space.create({ data: d({ name: "B", slug: "b" }) });
  });
  afterAll(() => cleanup());

  it("connect to FOREIGN space with tenantId injected → throws (no match)", async () => {
    const A = scoped(base, "alpha");
    const post = await A.post.create({
      data: d({ content: "p", space: { connect: { id: spaceA.id } }, author: { connect: { id: u1.id } } }),
    });
    // simulate the fix: tenantId injected into the connect where
    await expect(
      base.post.update({
        where: { id: post.id },
        data: { space: { connect: { id: spaceB.id, tenantId: "alpha" } } },
      }),
    ).rejects.toThrow();
  });

  it("connect to OWN space with tenantId injected → succeeds", async () => {
    const A = scoped(base, "alpha");
    const s2 = await A.space.create({ data: d({ name: "A2", slug: "a2" }) });
    const post = await A.post.create({
      data: d({ content: "p2", space: { connect: { id: spaceA.id } }, author: { connect: { id: u1.id } } }),
    });
    await base.post.update({
      where: { id: post.id },
      data: { space: { connect: { id: s2.id, tenantId: "alpha" } } },
    });
    const after = await base.post.findUnique({ where: { id: post.id } });
    expect(after?.spaceId).toBe(s2.id);
  });
});
