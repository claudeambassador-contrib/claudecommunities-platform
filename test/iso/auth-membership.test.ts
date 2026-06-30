import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMembershipPermissions } from "@/lib/permissions";
import { freshDb, scoped } from "./helpers";

// Membership-based authz. Two rules this encodes:
//   1. A user's tenant permissions come from their per-tenant `UserTenant.role`,
//      and a powerful role in one tenant must NOT leak into another.
//   2. The GLOBAL `User.role === "super_admin"` is the deliberate PLATFORM
//      OPERATOR grant — cross-tenant power, matching the platform console
//      (`(platform)/admin`). It is set only at bootstrap; a tenant-scoped admin
//      action must never write it. That escalation (a tenant admin minting a
//      global super_admin) is prevented in `assignRoleToUser` — see SECURITY.md #11.
describe("membership-based authz", () => {
  let base: PrismaClient;
  let cleanup: () => void;

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    // u1: a plain member. ta: a tenant super_admin (global role still "member").
    // op: a platform operator (global User.role = "super_admin").
    await base.user.create({
      data: { id: "u1", clerkId: "c1", email: "u1@x.com", name: "U1", role: "member" },
    });
    await base.user.create({
      data: { id: "ta", clerkId: "c2", email: "ta@x.com", name: "TA", role: "member" },
    });
    await base.user.create({
      data: { id: "op", clerkId: "c3", email: "op@x.com", name: "OP", role: "super_admin" },
    });

    await base.tenant.create({ data: { slug: "alpha", name: "Alpha", status: "active" } });
    await base.role.createMany({
      data: [
        {
          tenantId: "alpha",
          name: "super_admin",
          permissions: JSON.stringify(["users.edit", "roles.edit"]),
          isSystem: true,
        },
        { tenantId: "alpha", name: "admin", permissions: JSON.stringify(["users.edit"]), isSystem: true },
        { tenantId: "alpha", name: "member", permissions: "[]", isSystem: true },
      ],
    });
    await base.userTenant.create({ data: { tenantId: "alpha", userId: "u1", role: "member" } });
    await base.userTenant.create({ data: { tenantId: "alpha", userId: "ta", role: "super_admin" } });

    // beta exists with its own super_admin role, but ta/op are NOT members of it.
    await base.tenant.create({ data: { slug: "beta", name: "Beta", status: "active" } });
    await base.role.create({
      data: {
        tenantId: "beta",
        name: "super_admin",
        permissions: JSON.stringify(["users.edit"]),
        isSystem: true,
      },
    });
  });
  afterAll(() => cleanup());

  it("resolves a plain member to the membership role with its (empty) perms", async () => {
    const res = await getMembershipPermissions(scoped(base, "alpha"), "u1");
    expect(res.role).toBe("member");
    expect(res.permissions).toEqual([]);
  });

  it("grants a tenant's own super_admin membership full perms IN THAT tenant", async () => {
    const res = await getMembershipPermissions(scoped(base, "alpha"), "ta");
    expect(res.role).toBe("super_admin");
    expect(res.permissions.length).toBeGreaterThan(0);
  });

  it("does NOT leak a tenant super_admin into another tenant (no cross-tenant escalation)", async () => {
    // ta is alpha's super_admin but not a member of beta → nothing in beta.
    const res = await getMembershipPermissions(scoped(base, "beta"), "ta");
    expect(res.role).toBeNull();
    expect(res.permissions).toEqual([]);
  });

  it("treats a GLOBAL super_admin as a platform operator with power in every tenant (by design)", async () => {
    const inAlpha = await getMembershipPermissions(scoped(base, "alpha"), "op");
    const inBeta = await getMembershipPermissions(scoped(base, "beta"), "op"); // not a member of beta
    expect(inAlpha.role).toBe("super_admin");
    expect(inBeta.role).toBe("super_admin");
    expect(inBeta.permissions.length).toBeGreaterThan(0);
  });
});
