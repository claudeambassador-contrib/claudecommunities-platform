import { describe, expect, it } from "vitest";

import { hasPermission, permissionsForRole } from "@/shared/auth/permissions";

describe(permissionsForRole, () => {
  it("grants owners all permissions", () => {
    const perms = permissionsForRole("owner");
    expect(hasPermission(perms, "events.edit")).toBeTruthy();
    expect(hasPermission(perms, "roles.edit")).toBeTruthy();
  });

  it("denies members admin actions", () => {
    const perms = permissionsForRole("member");
    expect(hasPermission(perms, "events.edit")).toBeFalsy();
  });

  it("allows admins events but not role mutation", () => {
    const perms = permissionsForRole("admin");
    expect(hasPermission(perms, "events.edit")).toBeTruthy();
    expect(hasPermission(perms, "roles.edit")).toBeFalsy();
    expect(hasPermission(perms, "roles.view")).toBeTruthy();
  });
});
