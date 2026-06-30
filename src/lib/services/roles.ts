/**
 * Roles service — list / create / update / delete role definitions, plus the
 * "assign role to user" flow that keeps Clerk and D1 in sync.
 *
 * All route handlers and MCP tools must go through this module rather than
 * importing `@/lib/prisma` or `@/lib/clerk-roles` directly (ESLint blocks
 * the former).
 *
 * Multi-tenant: `Role` is tenant-scoped (`@@id([tenantId, name])`), so this
 * goes through `getPrisma()` (scoped). Because the PK is composite, by-name
 * mutations use `updateMany`/`deleteMany` (the chokepoint injects `tenantId`
 * into the loose `where`; a `tenantId_name` compound selector would collide
 * with that injection). The per-tenant user count comes from `UserTenant.role`.
 */
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  type Permission,
  parsePermissions,
  SYSTEM_ROLES,
} from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

export interface RoleSummary {
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
}

function validatePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) {
    throw new ServiceError("bad_request", "Permissions must be an array");
  }
  const allowed = new Set<string>(ALL_PERMISSIONS);
  const out: Permission[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !allowed.has(item)) {
      throw new ServiceError("bad_request", `Unknown permission: ${String(item)}`);
    }
    out.push(item as Permission);
  }
  // Dedup, stable order matching the registry for clean diffs.
  const seen = new Set(out);
  return ALL_PERMISSIONS.filter((p) => seen.has(p));
}

function validateRoleName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ServiceError("bad_request", "Role name is required");
  }
  const trimmed = name.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(trimmed)) {
    throw new ServiceError(
      "bad_request",
      "Role name must be 2-32 chars, lowercase letters / digits / underscore, and start with a letter",
    );
  }
  return trimmed;
}

/** Per-tenant count of members holding each role name. */
async function roleUserCounts(
  db: Awaited<ReturnType<typeof getPrisma>>,
): Promise<Map<string, number>> {
  const counts = await db.userTenant.groupBy({ by: ["role"], _count: { _all: true } });
  return new Map(counts.map((c) => [c.role, c._count._all]));
}

/** Public list — used by the admin UI and the user-mgmt role dropdown. */
export async function listRoles(actor: ActorLike): Promise<RoleSummary[]> {
  ensurePermission(actor, "roles.view");
  const db = await getPrisma();
  const rows = await db.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  const countByRole = await roleUserCounts(db);
  return rows.map((r) => ({
    name: r.name,
    description: r.description,
    permissions: parsePermissions(r.permissions),
    isSystem: r.isSystem,
    userCount: countByRole.get(r.name) ?? 0,
  }));
}

/**
 * Lightweight role list for assignment dropdowns. Available to anyone with
 * `users.assign_role` (so they don't also need `roles.view`).
 */
export async function listRolesForAssignment(
  actor: ActorLike,
): Promise<{ name: string; description: string | null }[]> {
  ensurePermission(actor, "users.assign_role");
  const db = await getPrisma();
  return db.role.findMany({
    select: { name: true, description: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function createRole(
  actor: ActorLike,
  input: { name: unknown; description?: unknown; permissions: unknown },
): Promise<RoleSummary> {
  ensurePermission(actor, "roles.edit");
  const db = await getPrisma();
  const name = validateRoleName(input.name);
  if (
    name === SYSTEM_ROLES.SUPER_ADMIN ||
    name === SYSTEM_ROLES.ADMIN ||
    name === SYSTEM_ROLES.MEMBER
  ) {
    throw new ServiceError("conflict", "That role name is reserved");
  }
  const existing = await db.role.findFirst({ where: { name } });
  if (existing) {
    throw new ServiceError("conflict", "A role with that name already exists");
  }
  const permissions = validatePermissions(input.permissions);
  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : null;

  const created = await db.role.create({
    data: { name, description, permissions: JSON.stringify(permissions), isSystem: false },
  });
  return {
    name: created.name,
    description: created.description,
    permissions,
    isSystem: false,
    userCount: 0,
  };
}

export async function updateRole(
  actor: ActorLike,
  name: string,
  input: { description?: unknown; permissions?: unknown },
): Promise<RoleSummary> {
  ensurePermission(actor, "roles.edit");
  const db = await getPrisma();
  const role = await db.role.findFirst({ where: { name } });
  if (!role) throw new ServiceError("not_found", "Role not found");

  // super_admin's permissions are locked so the role can always rescue an
  // app that's been mis-configured. Description can still be edited.
  if (role.name === SYSTEM_ROLES.SUPER_ADMIN && input.permissions !== undefined) {
    throw new ServiceError("forbidden", "super_admin permissions are locked");
  }

  const data: { description?: string | null; permissions?: string } = {};
  if (input.description !== undefined) {
    data.description =
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null;
  }
  if (input.permissions !== undefined) {
    data.permissions = JSON.stringify(validatePermissions(input.permissions));
  }
  if (Object.keys(data).length === 0) {
    throw new ServiceError("bad_request", "Nothing to update");
  }

  // Last-super-admin safety: if the edit removes `roles.edit` from a role
  // currently held by the actor, refuse — that would lock the system.
  if (data.permissions !== undefined && role.name === actor.role) {
    const newPerms = validatePermissions(input.permissions);
    if (!newPerms.includes("roles.edit")) {
      throw new ServiceError(
        "bad_request",
        "You can't remove roles.edit from your own role — promote someone else first",
      );
    }
  }

  // Composite PK → updateMany by the scoped (tenantId-injected) name, then refetch.
  await db.role.updateMany({ where: { name }, data });
  const updated = await db.role.findFirst({ where: { name } });
  const countByRole = await roleUserCounts(db);
  return {
    name: updated?.name ?? name,
    description: updated?.description ?? null,
    permissions: parsePermissions(updated?.permissions),
    isSystem: updated?.isSystem ?? false,
    userCount: countByRole.get(name) ?? 0,
  };
}

export async function deleteRole(actor: ActorLike, name: string): Promise<{ deleted: true }> {
  ensurePermission(actor, "roles.delete");
  const db = await getPrisma();
  const role = await db.role.findFirst({ where: { name } });
  if (!role) throw new ServiceError("not_found", "Role not found");
  if (role.isSystem) {
    throw new ServiceError("forbidden", "System roles cannot be deleted");
  }
  const assignedCount = await db.userTenant.count({ where: { role: name } });
  if (assignedCount > 0) {
    throw new ServiceError(
      "conflict",
      `Cannot delete role: ${assignedCount} user${assignedCount === 1 ? "" : "s"} still assigned`,
    );
  }
  await db.role.deleteMany({ where: { name } });
  return { deleted: true };
}

/**
 * Assign a role to a user within the current tenant. Updates ONLY the
 * membership's `UserTenant.role` (per-tenant) — it must NEVER write the global
 * `User.role`, which is the platform-operator flag (`getMembershipPermissions`
 * grants a global `super_admin` power in EVERY tenant + the platform console).
 *
 * SECURITY (SECURITY.md #11): this previously also mirrored the role to the
 * global `User.role` via `setUserRole`, so a tenant admin with `users.assign_role`
 * assigning their tenant's `super_admin` role minted a GLOBAL platform
 * super_admin — cross-tenant privilege escalation. The global role is now set
 * only at platform bootstrap, never from this tenant-scoped action.
 *
 * Refuses to demote the actor out of `users.assign_role` (self-lock).
 */
export async function assignRoleToUser(
  actor: ActorLike,
  targetUserId: string,
  roleName: string,
): Promise<{ id: string; role: string }> {
  ensurePermission(actor, "users.assign_role");
  const db = await getPrisma();

  const role = await db.role.findFirst({ where: { name: roleName } });
  if (!role) {
    throw new ServiceError("bad_request", "Unknown role");
  }

  if (actor.id === targetUserId) {
    const newPerms = parsePermissions(role.permissions);
    if (!newPerms.includes("users.assign_role")) {
      throw new ServiceError("bad_request", "You can't remove your own role-assignment permission");
    }
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) throw new ServiceError("not_found", "User not found");

  // Per-tenant role ONLY (membership is enforced by this scoped updateMany).
  // Deliberately does NOT touch the global `User.role` / Clerk metadata.
  const result = await db.userTenant.updateMany({
    where: { userId: targetUserId },
    data: { role: roleName },
  });
  if (result.count === 0) {
    throw new ServiceError("not_found", "User is not a member of this community");
  }

  return { id: target.id, role: roleName };
}

/**
 * Read-only permission catalog for the role editor UI. Returns the registry
 * data without DB access — safe to expose to any logged-in admin.
 */
export function getPermissionCatalog(actor: ActorLike) {
  ensurePermission(actor, "roles.view");
  return { permissions: PERMISSIONS };
}
