import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { d, freshDb, scoped, seedTenant, seedUser } from "./helpers";

// Junction models (e.g. Bookmark @@unique([tenantId, userId, postId])) are
// upserted by their composite unique. Does the scoped client accept the NEW
// compound selector while the extension also injects a top-level tenantId?
describe("compound-unique upsert/findUnique on the scoped client", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  let postA: { id: string };

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    const A = scoped(base, "alpha");
    await seedUser(base, "u1", "u1@x.com");
    await seedTenant(base, "alpha", "u1");
    const space = await A.space.create({ data: d({ name: "S", slug: "s" }) });
    postA = await A.post.create({
      data: d({ content: "p", space: { connect: { id: space.id } }, author: { connect: { id: "u1" } } }),
    });
  });
  afterAll(() => cleanup());

  it("upsert by the new compound selector works on the scoped client", async () => {
    const A = scoped(base, "alpha");
    // Bookmark unique is now @@unique([tenantId, userId, postId]) → selector
    // name is `tenantId_userId_postId`. The extension also injects top-level
    // tenantId; this asserts the two don't collide.
    const bm = await A.bookmark.upsert({
      where: { tenantId_userId_postId: { tenantId: "alpha", userId: "u1", postId: postA.id } },
      create: d({ user: { connect: { id: "u1" } }, post: { connect: { id: postA.id } } }),
      update: {},
    });
    expect(bm.tenantId).toBe("alpha");
    // idempotent second upsert finds the same row
    const bm2 = await A.bookmark.upsert({
      where: { tenantId_userId_postId: { tenantId: "alpha", userId: "u1", postId: postA.id } },
      create: d({ user: { connect: { id: "u1" } }, post: { connect: { id: postA.id } } }),
      update: {},
    });
    expect(bm2.id).toBe(bm.id);
    expect(await A.bookmark.count()).toBe(1);
  });

  it("findUnique by the new compound selector works on the scoped client", async () => {
    const A = scoped(base, "alpha");
    const bm = await A.bookmark.findUnique({
      where: { tenantId_userId_postId: { tenantId: "alpha", userId: "u1", postId: postA.id } },
    });
    expect(bm?.userId).toBe("u1");
  });
});
