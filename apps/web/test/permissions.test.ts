import { describe, expect, it } from "vitest";
import { hasPermission, permissionsForRole } from "@/shared/auth/permissions";

describe("permissionsForRole", () => {
  it("grants owners all permissions", () => {
    const perms = permissionsForRole("owner");
    expect(hasPermission(perms, "events.edit")).toBe(true);
    expect(hasPermission(perms, "roles.edit")).toBe(true);
  });

  it("denies members admin actions", () => {
    const perms = permissionsForRole("member");
    expect(hasPermission(perms, "events.edit")).toBe(false);
  });

  it("allows admins events but not role mutation", () => {
    const perms = permissionsForRole("admin");
    expect(hasPermission(perms, "events.edit")).toBe(true);
    expect(hasPermission(perms, "roles.edit")).toBe(false);
    expect(hasPermission(perms, "roles.view")).toBe(true);
  });
});
