import { type PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMembershipPermissions } from "@/lib/permissions";
import { freshDb, scoped } from "./helpers";

// THE PRIVESC TEST. The bug being fixed: authz derived permissions from the
// GLOBAL `User.role`, so a global "super_admin" got super_admin powers in EVERY
// tenant regardless of their actual membership. The fix resolves the role from
// the URL tenant's `UserTenant.role`. This test encodes the divergence: a user
// who is globally super_admin but only a *member* of tenant alpha must resolve
// to MEMBER permissions in alpha — never the global role — and to NOTHING in a
// tenant they don't belong to.
describe("membership-based authz (global User.role must be ignored)", () => {
  let base: PrismaClient;
  let cleanup: () => void;

  beforeAll(async () => {
    ({ base, cleanup } = freshDb());
    // Global identity says super_admin — the tempting-but-wrong source of truth.
    await base.user.create({ data: { id: "u1", clerkId: "c1", email: "u1@x.com", name: "U1", role: "super_admin" } });
    // alpha has real roles; u1 is only a MEMBER there (member = no perms).
    await base.tenant.create({ data: { slug: "alpha", name: "Alpha", status: "active" } });
    await base.role.createMany({
      data: [
        { tenantId: "alpha", name: "super_admin", permissions: JSON.stringify(["users.edit", "roles.edit"]), isSystem: true },
        { tenantId: "alpha", name: "admin", permissions: JSON.stringify(["users.edit"]), isSystem: true },
        { tenantId: "alpha", name: "member", permissions: "[]", isSystem: true },
      ],
    });
    await base.userTenant.create({ data: { tenantId: "alpha", userId: "u1", role: "member" } });
    // beta exists with a powerful super_admin role, but u1 is NOT a member.
    await base.tenant.create({ data: { slug: "beta", name: "Beta", status: "active" } });
    await base.role.create({ data: { tenantId: "beta", name: "super_admin", permissions: JSON.stringify(["users.edit"]), isSystem: true } });
  });
  afterAll(() => cleanup());

  it("resolves the MEMBERSHIP role, not the global super_admin role", async () => {
    const res = await getMembershipPermissions(scoped(base, "alpha"), "u1");
    expect(res.role).toBe("member"); // NOT "super_admin"
    expect(res.permissions).toEqual([]); // member has none — the global role is ignored
  });

  it("the divergence is real: alpha's super_admin role DOES carry perms (so [] is the membership, not an empty tenant)", async () => {
    const sa = await scoped(base, "alpha").role.findFirst({ where: { name: "super_admin" } });
    expect(JSON.parse(sa?.permissions ?? "[]").length).toBeGreaterThan(0);
  });

  it("denies entirely in a tenant the user is not a member of (no global-role leak across tenants)", async () => {
    const res = await getMembershipPermissions(scoped(base, "beta"), "u1");
    expect(res.role).toBeNull();
    expect(res.permissions).toEqual([]);
  });
});
