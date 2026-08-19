import { setMembershipRole } from "@/modules/identity/services/usersService";
import type { MembershipRole } from "@/modules/identity/types";
// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as rolesRepo from "@/modules/roles/repositories/rolesRepository";
import type { RoleInput, RolePatch, RoleSummary } from "@/modules/roles/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  type Permission,
  permissionsForRole,
} from "@/shared/auth/permissions";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

const ROLE_NAME = /^[a-z][a-z0-9_]{1,31}$/;
const RESERVED = new Set(["admin", "member", "owner", "super_admin"]);
const MEMBERSHIP_ROLES = new Set<MembershipRole>(["admin", "member", "owner"]);

function validateRoleName(name: string): Result<{ name: string }> {
  const trimmed = name.trim().toLowerCase();
  if (!ROLE_NAME.test(trimmed)) {
    return err(
      "bad_request",
      400,
      "Role name must be 2-32 chars, lowercase letters / digits / underscore, and start with a letter",
    );
  }
  return ok({ name: trimmed });
}

function validatePermissions(input: unknown): Result<{ permissions: Permission[] }> {
  if (!Array.isArray(input)) {
    return err("bad_request", 400, "Permissions must be an array");
  }
  const allowed = new Set<string>(ALL_PERMISSIONS);
  const seen = new Set<Permission>();
  for (const item of input) {
    if (typeof item !== "string" || !allowed.has(item)) {
      return err("bad_request", 400, `Unknown permission: ${String(item)}`);
    }
    seen.add(item as Permission);
  }
  return ok({ permissions: ALL_PERMISSIONS.filter((permission) => seen.has(permission)) });
}

async function ensureSystemRoles(store: TenantStore): Promise<void> {
  const seeds: Array<{ description: string; name: MembershipRole }> = [
    { description: "City owner", name: "owner" },
    { description: "City admin", name: "admin" },
    { description: "Community member", name: "member" },
  ];
  await Promise.all(
    seeds.map((seed) =>
      rolesRepo.insertRole(store, {
        description: seed.description,
        isSystem: true,
        name: seed.name,
        permissions: [...permissionsForRole(seed.name)],
      }),
    ),
  );
}

export async function listRoles(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ roles: RoleSummary[] }>> {
  const perm = ensurePermission(actor, "roles.view");
  if (!perm.ok) {
    return perm;
  }
  await ensureSystemRoles(store);
  return ok({ roles: await rolesRepo.listRoles(store) });
}

export async function listRolesForAssignment(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ roles: Array<{ description: string | null; name: string }> }>> {
  const perm = ensurePermission(actor, "users.assign_role");
  if (!perm.ok) {
    return perm;
  }
  await ensureSystemRoles(store);
  const roles = await rolesRepo.listRoles(store);
  return ok({
    roles: roles.map((role) => ({ description: role.description, name: role.name })),
  });
}

export async function createRole(
  store: TenantStore,
  actor: Actor,
  input: RoleInput,
): Promise<Result<{ role: RoleSummary }>> {
  const perm = ensurePermission(actor, "roles.edit");
  if (!perm.ok) {
    return perm;
  }
  const name = validateRoleName(input.name);
  if (!name.ok) {
    return name;
  }
  if (RESERVED.has(name.name)) {
    return err("conflict", 409, "That role name is reserved");
  }
  const permissions = validatePermissions(input.permissions);
  if (!permissions.ok) {
    return permissions;
  }
  const description = input.description?.trim() || null;
  return await rolesRepo.insertRole(store, {
    description,
    name: name.name,
    permissions: permissions.permissions,
  });
}

export async function updateRole(
  store: TenantStore,
  actor: Actor,
  name: string,
  input: RolePatch,
): Promise<Result<{ role: RoleSummary }>> {
  const perm = ensurePermission(actor, "roles.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await rolesRepo.findRoleByName(store, name);
  if (!existing) {
    return err("not_found", 404, "Role not found");
  }
  if (existing.name === "owner" && input.permissions !== undefined) {
    return err("forbidden", 403, "owner permissions are locked");
  }
  const patch: { description?: string | null; permissions?: Permission[] } = {};
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.permissions !== undefined) {
    const permissions = validatePermissions(input.permissions);
    if (!permissions.ok) {
      return permissions;
    }
    patch.permissions = permissions.permissions;
  }
  if (patch.description === undefined && patch.permissions === undefined) {
    return err("bad_request", 400, "Nothing to update");
  }
  return await rolesRepo.updateRoleByName(store, name, patch);
}

export async function removeRole(
  store: TenantStore,
  actor: Actor,
  name: string,
): Promise<Result<{ deleted: true }>> {
  const perm = ensurePermission(actor, "roles.delete");
  if (!perm.ok) {
    return perm;
  }
  return await rolesRepo.deleteRoleByName(store, name);
}

export function getPermissionCatalog(actor: Actor): Result<{ permissions: typeof PERMISSIONS }> {
  const perm = ensurePermission(actor, "roles.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ permissions: PERMISSIONS });
}

export async function assignRoleToUser(
  registry: RegistryStore,
  actor: Actor,
  orgId: string,
  targetUserId: string,
  roleName: string,
): Promise<Result<{ id: string; role: MembershipRole }>> {
  const perm = ensurePermission(actor, "users.assign_role");
  if (!perm.ok) {
    return perm;
  }
  if (!MEMBERSHIP_ROLES.has(roleName as MembershipRole)) {
    return err("bad_request", 400, "Unknown role");
  }
  const role = roleName as MembershipRole;
  if (actor.id === targetUserId && !permissionsForRole(role).has("users.assign_role")) {
    return err("bad_request", 400, "You can't remove your own role-assignment permission");
  }
  return await setMembershipRole(registry, orgId, targetUserId, role);
}
