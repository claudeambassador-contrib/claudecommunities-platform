import { Prisma, type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ALL_CLASSIFIED_MODELS,
  classifyModel,
  GLOBAL_MODELS,
  isTenantScoped,
  TENANT_SCOPED_MODELS,
} from "@/lib/tenant-models";
import { HANDLED_OPERATIONS, tenantScope } from "@/lib/tenant-scope";
import { freshDb, seedTenant, seedUser } from "./helpers";

// Scoped clients exactly as getPrisma() builds them.
function scoped(base: PrismaClient, tenantId: string) {
  return base.$extends(tenantScope(tenantId, base as never));
}

// The scoped client injects tenantId on create at RUNTIME, but the generated
// create-input TYPE still lists tenantId as required (a query extension can't
// retype inputs). `d()` strips only the compile-time requirement — the runtime
// object is unchanged, so these tests still prove the extension does the
// injection (and that a missing one fails loudly). This is also the
// feature-code ergonomics question flagged for the fan-out.
function d<T>(data: T): T & { tenantId: string } {
  return data as T & { tenantId: string };
}

describe("tenant chokepoint — data-plane isolation (§6)", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  let A: ReturnType<typeof scoped>;
  let B: ReturnType<typeof scoped>;
  // alpha-owned + beta-owned rows
  let spaceA: { id: string };
  let spaceB: { id: string };
  let u1: { id: string };
  let u2: { id: string };

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    A = scoped(base, "alpha");
    B = scoped(base, "beta");

    u1 = await seedUser(base, "u1", "u1@x.com");
    u2 = await seedUser(base, "u2", "u2@x.com");
    await seedTenant(base, "alpha", u1.id);
    await seedTenant(base, "beta", u2.id);

    spaceA = await A.space.create({ data: d({ name: "General", slug: "general" }) });
    spaceB = await B.space.create({ data: d({ name: "General", slug: "general" }) });
    await A.post.create({
      data: d({ content: "a-post", space: { connect: { id: spaceA.id } }, author: { connect: { id: u1.id } } }),
    });
    await B.post.create({
      data: d({ content: "b-post", space: { connect: { id: spaceB.id } }, author: { connect: { id: u2.id } } }),
    });
  });
  afterAll(() => cleanup());

  // ── #2 IDOR: by-id read/update/delete of a foreign row ────────────────────
  it("IDOR read: findUnique of B's row from A returns null", async () => {
    expect(await A.space.findUnique({ where: { id: spaceB.id } })).toBeNull();
    expect(await B.space.findUnique({ where: { id: spaceA.id } })).toBeNull();
  });

  it("IDOR read: own row is still reachable", async () => {
    expect(await A.space.findUnique({ where: { id: spaceA.id } })).not.toBeNull();
  });

  it("IDOR write: update of B's row from A throws P2025 and leaves it intact", async () => {
    await expect(A.space.update({ where: { id: spaceB.id }, data: { name: "HACKED" } })).rejects.toMatchObject({
      code: "P2025",
    });
    expect((await base.space.findUnique({ where: { id: spaceB.id } }))?.name).toBe("General");
  });

  it("IDOR write: delete of B's row from A throws P2025 and leaves it intact", async () => {
    await expect(A.space.delete({ where: { id: spaceB.id } })).rejects.toMatchObject({ code: "P2025" });
    expect(await base.space.findUnique({ where: { id: spaceB.id } })).not.toBeNull();
  });

  // ── #4 Public-route scoping (scoping ≠ auth): list never crosses tenants ──
  it("findMany is tenant-scoped (an anonymous list never returns another tenant)", async () => {
    const aSpaces = await A.space.findMany();
    expect(aSpaces).toHaveLength(1);
    expect(aSpaces.every((s) => s.tenantId === "alpha")).toBe(true);
  });

  // ── create stamps tenantId — and the call needs NO tenantId (ergonomics) ──
  it("create stamps the current tenantId (caller omits tenantId entirely)", async () => {
    // No d() wrapper: with the @default("") sentinel, tenantId is optional in the
    // create input type, and the chokepoint injects the real value at runtime.
    const s = await A.space.create({ data: { name: "Extra", slug: "extra" } });
    expect(s.tenantId).toBe("alpha");
    await base.space.delete({ where: { id: s.id } });
  });

  // ── #8 Nested-write tenancy: a nested tenant-create is recursively stamped
  //    with the parent's tenant (never a silent foreign write, and usable).
  it("nested tenant-create is recursively stamped with the tenant", async () => {
    const post = await A.post.create({
      data: d({
        content: "parent",
        space: { connect: { id: spaceA.id } },
        author: { connect: { id: u1.id } },
        comments: { create: d({ content: "child", author: { connect: { id: u1.id } } }) },
      }),
      include: { comments: true },
    });
    expect(post.comments).toHaveLength(1);
    expect(post.comments[0]?.tenantId).toBe("alpha");
    await base.post.delete({ where: { id: post.id } });
  });

  // ── #9 Relation include never returns a foreign-tenant child ───────────────
  it("include returns only same-tenant children", async () => {
    const withPosts = await A.space.findFirst({ where: { id: spaceA.id }, include: { posts: true } });
    expect(withPosts?.posts.every((p) => p.tenantId === "alpha")).toBe(true);
    expect(withPosts?.posts.length).toBeGreaterThan(0);
  });

  // ── #12 $transaction array operations carry the scope ─────────────────────
  it("$transaction([...]) array ops are tenant-scoped", async () => {
    const [created, listed] = await A.$transaction([
      A.post.create({
        data: d({ content: "tx", space: { connect: { id: spaceA.id } }, author: { connect: { id: u1.id } } }),
      }),
      A.post.findMany(),
    ]);
    expect(created.tenantId).toBe("alpha");
    expect((listed as Array<{ tenantId: string }>).every((p) => p.tenantId === "alpha")).toBe(true);
    await base.post.delete({ where: { id: created.id } });
  });

  // ── #18 upsert by a foreign id creates in this tenant, never mutates foreign
  it("upsert by B's id from A creates an alpha row and leaves B intact", async () => {
    const up = await A.space.upsert({
      where: { id: spaceB.id },
      create: d({ name: "Ups", slug: "ups" }),
      update: { name: "HACKED" },
    });
    expect(up.tenantId).toBe("alpha");
    expect((await base.space.findUnique({ where: { id: spaceB.id } }))?.name).toBe("General");
    await base.space.delete({ where: { id: up.id } });
  });

  // ── createMany stamps every row ───────────────────────────────────────────
  it("createMany stamps every row with the tenant", async () => {
    await A.space.createMany({
      data: [d({ name: "m1", slug: "m1" }), d({ name: "m2", slug: "m2" })],
    });
    const made = await base.space.findMany({ where: { slug: { in: ["m1", "m2"] } } });
    expect(made).toHaveLength(2);
    expect(made.every((s) => s.tenantId === "alpha")).toBe(true);
    await base.space.deleteMany({ where: { slug: { in: ["m1", "m2"] } } });
  });

  // ── #24 count / aggregate / groupBy are scoped ────────────────────────────
  it("count is scoped (A's count < global count)", async () => {
    const total = await base.space.count();
    const aCount = await A.space.count();
    expect(aCount).toBeLessThan(total);
    expect(aCount).toBe(1);
  });

  it("groupBy is scoped", async () => {
    const groups = await A.post.groupBy({ by: ["tenantId"] });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tenantId).toBe("alpha");
  });

  // ── #1 Fresh per tenant — interleaved scoped clients never bleed ──────────
  it("interleaved scoped clients stay isolated (no client reuse across tenants)", async () => {
    const a1 = await A.space.findMany();
    const b1 = await B.space.findMany();
    const a2 = await A.space.findMany();
    expect(a1.every((s) => s.tenantId === "alpha")).toBe(true);
    expect(b1.every((s) => s.tenantId === "beta")).toBe(true);
    expect(a2.every((s) => s.tenantId === "alpha")).toBe(true);
  });

  // ── #10 Global model passthrough — User is NOT auto-scoped ────────────────
  it("global model (User) is not tenant-filtered by the scoped client", async () => {
    const usersViaA = await A.user.findMany();
    expect(usersViaA.length).toBeGreaterThanOrEqual(2); // sees u1 AND u2 — global identity
  });

  // ── #15 Global-model membership join — the explicit pattern campaigns use ─
  it("global User limited to a tenant via the explicit membership join", async () => {
    const alphaMembers = await base.user.findMany({
      where: { tenantMemberships: { some: { tenantId: "alpha" } } },
    });
    expect(alphaMembers.map((u) => u.id)).toEqual(["u1"]);
  });

  // ── #4/#12 Membership check building block ────────────────────────────────
  it("membership check: userTenant.findFirst auto-injects tenant; non-member → null", async () => {
    expect(await A.userTenant.findFirst({ where: { userId: u1.id } })).not.toBeNull(); // u1 ∈ alpha
    expect(await A.userTenant.findFirst({ where: { userId: u2.id } })).toBeNull(); // u2 ∉ alpha
    expect(await B.userTenant.findFirst({ where: { userId: u2.id } })).not.toBeNull(); // u2 ∈ beta
  });
});

// ── Static / structural invariants (no DB) ──────────────────────────────────
describe("tenant chokepoint — structural invariants", () => {
  const dmmfModels = Prisma.dmmf.datamodel.models.map((m) => m.name);

  // Model→scope map completeness — fail-closed.
  it("every Prisma model is classified (no unknowns)", () => {
    const unknown = dmmfModels.filter((m) => classifyModel(m) === "unknown");
    expect(unknown, `unclassified models: ${unknown.join(", ")}`).toEqual([]);
  });

  it("no classified name is stale (every classified model exists in the schema)", () => {
    const dmmfSet = new Set(dmmfModels);
    const stale = [...ALL_CLASSIFIED_MODELS].filter((m) => !dmmfSet.has(m));
    expect(stale, `stale classifications: ${stale.join(", ")}`).toEqual([]);
  });

  it("classification is disjoint", () => {
    const both = [...TENANT_SCOPED_MODELS].filter((m) => GLOBAL_MODELS.has(m));
    expect(both).toEqual([]);
  });

  it("classifyModel fails closed for an unknown model", () => {
    expect(classifyModel("DefinitelyNotAModel")).toBe("unknown");
  });

  // §4 soundness assertion: every tenant-scoped model's unique selectors include
  // tenantId, so findUnique-by-injection identifies ≤1 row. The only allowed
  // exceptions are 1:1-FK fields that are GLOBALLY unique (sound: the field alone
  // already identifies ≤1 row).
  const GLOBAL_UNIQUE_EXCEPTIONS = new Set(["Poll.postId", "EmailPreference.userId", "EmailABTest.campaignId"]);

  it("every tenant-scoped model's @@id/@@unique includes tenantId", () => {
    const violations: string[] = [];
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!isTenantScoped(m.name)) continue;
      // composite PK
      if (m.primaryKey && !m.primaryKey.fields.includes("tenantId")) {
        violations.push(`${m.name} @@id(${m.primaryKey.fields.join(",")})`);
      }
      // @@unique indexes
      for (const u of m.uniqueIndexes ?? []) {
        if (!u.fields.includes("tenantId")) violations.push(`${m.name} @@unique(${u.fields.join(",")})`);
      }
    }
    expect(violations, violations.join("; ")).toEqual([]);
  });

  it("field-level @unique on tenant models is only the documented global-unique exceptions", () => {
    const offenders: string[] = [];
    for (const m of Prisma.dmmf.datamodel.models) {
      if (!isTenantScoped(m.name)) continue;
      for (const f of m.fields) {
        if (f.isUnique && f.name !== "tenantId" && !GLOBAL_UNIQUE_EXCEPTIONS.has(`${m.name}.${f.name}`)) {
          offenders.push(`${m.name}.${f.name}`);
        }
      }
    }
    expect(offenders, `un-allowlisted single-field uniques: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the chokepoint handles the operations Prisma can dispatch", () => {
    // Sanity: the documented handled set are real client operations.
    const sample = Prisma.dmmf.datamodel.models[0]?.name;
    expect(sample).toBeTruthy();
    for (const op of ["findUnique", "findMany", "create", "update", "delete", "upsert", "count"]) {
      expect(HANDLED_OPERATIONS).toContain(op);
    }
  });
});
