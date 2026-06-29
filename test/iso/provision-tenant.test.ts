import { describe, expect, it } from "vitest";
import { buildProvisionSql } from "../../scripts/provision-tenant";
import { ALL_PERMISSIONS } from "@/lib/permissions";

// The provisioning SQL is hand-rolled (no Prisma binding in a tsx script), so
// lock the parts that are easy to get subtly wrong: the role-permission JSON is
// derived from ALL_PERMISSIONS (not hand-typed), the owner is bound by email,
// and an invalid slug fails loudly instead of emitting broken SQL.
const ids = { user: "usr_test", membership: "ut_test", clerkSuffix: "deadbeef" };
const sql = buildProvisionSql({ slug: "acme", name: "Acme Community", ownerEmail: "You@Acme.test", ids });

describe("buildProvisionSql", () => {
  it("creates the tenant, settings, and three system roles", () => {
    expect(sql).toContain(`INSERT OR IGNORE INTO "Tenant"`);
    expect(sql).toContain(`INSERT OR IGNORE INTO "TenantSetting"`);
    expect(sql).toContain(`'super_admin'`);
    expect(sql).toContain(`'admin'`);
    expect(sql).toContain(`'member'`);
  });

  it("seeds the super_admin role with the full permission set (derived, not hand-typed)", () => {
    const allPerms = JSON.stringify(ALL_PERMISSIONS).replace(/'/g, "''");
    expect(sql).toContain(allPerms);
    expect(allPerms.length).toBeGreaterThan(2); // not the empty-array member role
  });

  it("binds the owner membership by email (works for a just-created or pre-existing User) with super_admin", () => {
    // owner = super_admin, NOT the unseeded "owner" role (which → zero perms).
    expect(sql).toContain(
      `SELECT 'ut_test', 'acme', "id", 'super_admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "User" WHERE "email" = 'you@acme.test'`,
    );
  });

  it("lowercases the slug + email and stamps a provision_ placeholder clerkId", () => {
    expect(sql).toContain(`provision_acme_deadbeef`);
    expect(sql).toContain(`'you@acme.test'`); // email lowercased
  });

  it("emits NULL customDomain when omitted, and the value when present", () => {
    expect(sql).toContain(`, NULL, 'Acme Community', 'active'`);
    const withDomain = buildProvisionSql({ slug: "acme", name: "Acme", ownerEmail: "x@y.z", customDomain: "acme.test", ids });
    expect(withDomain).toContain(`'acme.test'`);
  });

  it("rejects an invalid slug and a bad email", () => {
    expect(() => buildProvisionSql({ slug: "Admin", name: "x", ownerEmail: "a@b.c" })).toThrow(/Invalid tenant slug/);
    expect(() => buildProvisionSql({ slug: "ok", name: "x", ownerEmail: "no-at-sign" })).toThrow(/Invalid owner email/);
  });

  it("escapes single quotes in the display name (SQL-injection-safe literal)", () => {
    const s = buildProvisionSql({ slug: "acme", name: "O'Brien's", ownerEmail: "x@y.z", ids });
    expect(s).toContain(`'O''Brien''s'`);
  });
});
