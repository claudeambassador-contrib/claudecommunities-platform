import { describe, expect, it } from "vitest";
import { buildPlatformSeedSql } from "../../scripts/seed-platform";

// The Tenants configurator gates on the GLOBAL `User.role === "super_admin"`,
// but `buildProvisionSql` only grants a super_admin *membership* (global role
// stays "member"). The platform seed must close that gap with an explicit
// UPDATE — otherwise the seeded owner signs up and hits a 403. Lock that
// contract here so a future refactor can't silently break login.
describe("buildPlatformSeedSql", () => {
  const sql = buildPlatformSeedSql({ ownerEmail: "You@Example.com" });

  it("provisions the home tenant 'platform' (registry + settings + roles)", () => {
    expect(sql).toContain(`INSERT OR IGNORE INTO "Tenant"`);
    expect(sql).toContain(`'platform'`);
    expect(sql).toContain(`INSERT OR IGNORE INTO "TenantSetting"`);
  });

  it("promotes the owner to GLOBAL super_admin so the configurator gate agrees", () => {
    expect(sql).toContain(
      `UPDATE "User" SET "role" = 'super_admin' WHERE "email" = 'you@example.com'`,
    );
  });

  it("also grants the super_admin membership (via the provisioning SQL)", () => {
    expect(sql).toContain(`'super_admin'`);
    expect(sql).toContain(`INSERT OR IGNORE INTO "UserTenant"`);
  });

  it("honours an explicit slug + name override", () => {
    const custom = buildPlatformSeedSql({ ownerEmail: "a@b.c", slug: "home", name: "Home" });
    expect(custom).toContain(`'home'`);
    expect(custom).toContain(`'Home'`);
  });
});
