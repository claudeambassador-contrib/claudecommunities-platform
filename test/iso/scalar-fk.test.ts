import { Prisma, type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SCALAR_FK_TO_REL } from "@/lib/tenant-scope";
import { d, freshDb, scoped, seedUser } from "./helpers";

// Structural guards on the DMMF-derived map (the runtime DMMF strips
// relationFromFields, so the map relies on the `<rel>Id` convention — these lock
// it). If a future schema change breaks the convention or adds a composite-PK
// target, these fail loudly instead of leaving a scalar FK silently unscoped.
describe("SCALAR_FK_TO_REL map (completeness + correctness)", () => {
  it("maps the known tenant-scoped scalar FKs (incl. self-referential)", () => {
    expect(SCALAR_FK_TO_REL.Post?.spaceId).toBe("space");
    expect(SCALAR_FK_TO_REL.Comment?.postId).toBe("post");
    expect(SCALAR_FK_TO_REL.Comment?.parentId).toBe("parent");
    expect(SCALAR_FK_TO_REL.Like?.postId).toBe("post");
  });
  it("excludes GLOBAL-target FKs — authorId/userId → User stay raw scalars", () => {
    expect(SCALAR_FK_TO_REL.Post?.authorId).toBeUndefined();
    expect(SCALAR_FK_TO_REL.Comment?.authorId).toBeUndefined();
    expect(SCALAR_FK_TO_REL.Like?.userId).toBeUndefined();
  });
  it("every mapped target is connect-by-id resolvable (has an `id` PK)", () => {
    const models = Prisma.dmmf.datamodel.models;
    const hasId = (n: string) =>
      !!models.find((m) => m.name === n)?.fields.some((f) => f.name === "id");
    for (const [model, fks] of Object.entries(SCALAR_FK_TO_REL)) {
      const md = models.find((m) => m.name === model);
      for (const rel of Object.values(fks)) {
        const target = md?.fields.find((f) => f.name === rel)?.type ?? "";
        expect(hasId(target), `${model}.${rel} -> ${target} must have an id PK`).toBe(true);
      }
    }
  });
});

// SCALAR-FK CROSS-TENANT WRITE. The chokepoint scopes nested RELATION writes
// (connect/create/…) but a raw scalar foreign key in `data` (e.g. `spaceId: X`)
// is not a relation key, so it used to pass through untouched: a member could
// `post.create({ data: { spaceId: <other tenant's space> } })` and the post
// would be stored with tenantId=A but spaceId=B — then `include: { space }`
// reads B's space (includes rely on FK integrity, which this broke). This is the
// scalar analog of the nested-`connect` IDOR. The fix rewrites a scalar FK to a
// tenant-scoped relation into a SCOPED `connect` so a foreign id finds no row and
// throws. Global-target FKs (authorId → User) must stay scalar.
describe("scalar-FK writes cannot cross tenants", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  let A: ReturnType<typeof scoped>;
  let B: ReturnType<typeof scoped>;
  let alphaSpace: { id: string };
  let betaSpace: { id: string };
  let betaPost: { id: string };
  let betaComment: { id: string };

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    await seedUser(base, "u1", "u1@x.com");
    for (const slug of ["alpha", "beta"]) {
      await base.tenant.create({ data: { slug, name: slug, status: "active" } });
    }
    A = scoped(base, "alpha");
    B = scoped(base, "beta");
    alphaSpace = await A.space.create({ data: d({ name: "A", slug: "a" }) });
    betaSpace = await B.space.create({ data: d({ name: "B", slug: "b" }) });
    betaPost = await B.post.create({
      data: d({ content: "bp", spaceId: betaSpace.id, authorId: "u1" }),
    });
    betaComment = await B.comment.create({
      data: d({ content: "bc", postId: betaPost.id, authorId: "u1" }),
    });
  });
  afterAll(() => cleanup());

  it("create: a foreign-tenant scalar spaceId is rejected (no cross-tenant FK planted)", async () => {
    await expect(
      A.post.create({ data: d({ content: "x", spaceId: betaSpace.id, authorId: "u1" }) }),
    ).rejects.toThrow();
    expect(await A.post.count()).toBe(0); // nothing leaked into alpha
  });

  it("create: an in-tenant scalar spaceId succeeds; the GLOBAL authorId stays scalar", async () => {
    const p = await A.post.create({
      data: d({ content: "ok", spaceId: alphaSpace.id, authorId: "u1" }),
    });
    const row = await base.post.findUnique({ where: { id: p.id } });
    expect(row?.tenantId).toBe("alpha");
    expect(row?.spaceId).toBe(alphaSpace.id);
    expect(row?.authorId).toBe("u1"); // authorId → User is global: NOT rewritten
    await base.post.delete({ where: { id: p.id } });
  });

  it("update: re-parenting a post onto a foreign-tenant space is rejected", async () => {
    const p = await A.post.create({
      data: d({ content: "u", spaceId: alphaSpace.id, authorId: "u1" }),
    });
    await expect(
      A.post.update({ where: { id: p.id }, data: { spaceId: betaSpace.id } }),
    ).rejects.toThrow();
    expect((await base.post.findUnique({ where: { id: p.id } }))?.spaceId).toBe(alphaSpace.id);
    await base.post.delete({ where: { id: p.id } });
  });

  it("self-referential: a foreign-tenant parentId on a comment is rejected", async () => {
    const ap = await A.post.create({
      data: d({ content: "ap", spaceId: alphaSpace.id, authorId: "u1" }),
    });
    await expect(
      A.comment.create({
        data: d({ content: "c", postId: ap.id, authorId: "u1", parentId: betaComment.id }),
      }),
    ).rejects.toThrow();
    await base.post.delete({ where: { id: ap.id } });
  });

  it("a nullable FK explicitly set to null is left alone (no spurious connect)", async () => {
    const ap = await A.post.create({
      data: d({ content: "ap2", spaceId: alphaSpace.id, authorId: "u1" }),
    });
    const c = await A.comment.create({
      data: d({ content: "root", postId: ap.id, authorId: "u1", parentId: null }),
    });
    expect(c.parentId).toBeNull();
    await base.post.delete({ where: { id: ap.id } });
  });

  it("createMany with a scalar FK to a tenant-scoped relation FAILS CLOSED", async () => {
    // createMany can't carry a per-row connect, so the chokepoint cannot validate
    // the FK target is in-tenant — it must refuse rather than silently insert.
    await expect(
      A.like.createMany({ data: [d({ postId: betaPost.id, userId: "u1" })] }),
    ).rejects.toThrow(/createMany/);
  });
});
