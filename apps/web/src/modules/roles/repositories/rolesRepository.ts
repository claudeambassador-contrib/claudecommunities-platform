import { and, asc, desc, eq } from "drizzle-orm";
import type { RoleSummary, RoleWrite } from "@/modules/roles/types";
import { type Permission, parsePermissions } from "@/shared/auth/permissions";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function toSummary(
  row: {
    description: string | null;
    isSystem: boolean;
    name: string;
    permissionsJson: string;
  },
  userCount: number,
): RoleSummary {
  return {
    description: row.description,
    isSystem: Boolean(row.isSystem),
    name: row.name,
    permissions: parsePermissions(row.permissionsJson),
    userCount,
  };
}

export async function listRoles(store: TenantStore): Promise<RoleSummary[]> {
  const { roles } = store.tables;
  const rows = await store.db
    .select()
    .from(roles)
    .where(eq(roles.orgId, store.orgId))
    .orderBy(desc(roles.isSystem), asc(roles.name));
  return rows.map((row) => toSummary(row, 0));
}

export async function findRoleByName(
  store: TenantStore,
  name: string,
): Promise<RoleSummary | null> {
  const { roles } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(roles)
      .where(and(eq(roles.orgId, store.orgId), eq(roles.name, name)))
      .limit(1),
  );
  return row ? toSummary(row, 0) : null;
}

export async function insertRole(
  store: TenantStore,
  write: RoleWrite,
): Promise<Result<{ role: RoleSummary }>> {
  const { roles } = store.tables;
  const now = new Date();
  try {
    await store.db.insert(roles).values({
      createdAt: now,
      description: write.description,
      id: newId("rol"),
      isSystem: Boolean(write.isSystem),
      name: write.name,
      orgId: store.orgId,
      permissionsJson: JSON.stringify(write.permissions),
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A role with that name already exists");
    }
    throw error;
  }
  return ok({
    role: {
      description: write.description,
      isSystem: Boolean(write.isSystem),
      name: write.name,
      permissions: write.permissions,
      userCount: 0,
    },
  });
}

export async function updateRoleByName(
  store: TenantStore,
  name: string,
  patch: { description?: string | null; permissions?: Permission[] },
): Promise<Result<{ role: RoleSummary }>> {
  const existing = await findRoleByName(store, name);
  if (!existing) {
    return err("not_found", 404, "Role not found");
  }
  const { roles } = store.tables;
  const set: { description?: string | null; permissionsJson?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.description !== undefined) {
    set.description = patch.description;
  }
  if (patch.permissions) {
    set.permissionsJson = JSON.stringify(patch.permissions);
  }
  await store.db
    .update(roles)
    .set(set)
    .where(and(eq(roles.orgId, store.orgId), eq(roles.name, name)));
  const updated = await findRoleByName(store, name);
  if (!updated) {
    return err("not_found", 404, "Role not found");
  }
  return ok({ role: updated });
}

export async function deleteRoleByName(
  store: TenantStore,
  name: string,
): Promise<Result<{ deleted: true }>> {
  const existing = await findRoleByName(store, name);
  if (!existing) {
    return err("not_found", 404, "Role not found");
  }
  if (existing.isSystem) {
    return err("forbidden", 403, "System roles cannot be deleted");
  }
  const { roles } = store.tables;
  await store.db.delete(roles).where(and(eq(roles.orgId, store.orgId), eq(roles.name, name)));
  return ok({ deleted: true });
}
