import { describe, expect, it } from "vitest";
import { insertMembership, insertUser } from "@/modules/identity/repositories/directoryRepository";
import {
  assignRoleToUser,
  createRole,
  getPermissionCatalog,
  listRoles,
  removeRole,
  updateRole,
} from "@/modules/roles/services/rolesService";
import { openMemoryRegistry } from "../helpers/registry";
import { adminActor, memberActor, openMemoryTenant, ownerActor } from "../helpers/tenant";

describe("rolesService", () => {
  it("seeds system roles and creates a custom role", async () => {
    const store = openMemoryTenant();
    const denied = await listRoles(store, memberActor());
    expect(denied.ok).toBe(false);

    const listed = await listRoles(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.roles.map((role) => role.name)).toEqual(["admin", "member", "owner"]);
    expect(listed.roles.every((role) => role.isSystem)).toBe(true);

    const reserved = await createRole(store, ownerActor(), {
      name: "admin",
      permissions: ["events.view"],
    });
    expect(reserved.ok).toBe(false);

    const created = await createRole(store, ownerActor(), {
      description: "Event ops",
      name: "events_lead",
      permissions: ["events.view", "events.edit"],
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.role.permissions).toEqual(["events.edit", "events.view"]);
    }

    const catalog = getPermissionCatalog(adminActor());
    expect(catalog.ok).toBe(true);
  });

  it("locks owner permissions, refuses system deletes, and assigns membership roles", async () => {
    const store = openMemoryTenant();
    await listRoles(store, ownerActor());
    const locked = await updateRole(store, ownerActor(), "owner", {
      permissions: ["events.view"],
    });
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.error.status).toBe(403);
    }

    const systemDelete = await removeRole(store, ownerActor(), "member");
    expect(systemDelete.ok).toBe(false);

    const custom = await createRole(store, ownerActor(), {
      name: "host",
      permissions: ["events.view"],
    });
    expect(custom.ok).toBe(true);
    if (custom.ok) {
      const removed = await removeRole(store, ownerActor(), custom.role.name);
      expect(removed.ok).toBe(true);
    }

    const registry = openMemoryRegistry();
    const user = await insertUser(registry, {
      clerkUserId: "clk_ada",
      email: "ada@example.com",
      id: "usr_ada",
    });
    await insertMembership(registry, { orgId: store.orgId, role: "member", userId: user.id });
    const assigned = await assignRoleToUser(registry, adminActor(), store.orgId, user.id, "admin");
    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.role).toBe("admin");
    }

    const selfDemote = await assignRoleToUser(
      registry,
      adminActor({ id: user.id }),
      store.orgId,
      user.id,
      "member",
    );
    expect(selfDemote.ok).toBe(false);
  });
});
