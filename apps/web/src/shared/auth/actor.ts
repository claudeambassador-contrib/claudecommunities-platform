import { hasPermission } from "@/shared/auth/permissions";
import type { Permission } from "@/shared/auth/permissions";
import { err, ok } from "@/shared/http/errors";
import type { Empty, Result } from "@/shared/http/errors";

/** Transport-agnostic actor passed into domain services. */
export interface Actor {
  email?: string | null;
  id: string;
  isSuperAdmin?: boolean;
  name?: string | null;
  permissions: ReadonlySet<Permission>;
}

export function ensurePermission(actor: Actor, permission: Permission): Result<Empty> {
  if (actor.isSuperAdmin) {
    return ok({});
  }
  if (!hasPermission(actor.permissions, permission)) {
    return err("forbidden", 403, `Missing permission: ${permission}`);
  }
  return ok({});
}

export function requireActor(actor: Actor | null | undefined): Result<{ actor: Actor }> {
  if (!actor) {
    return err("unauthenticated", 401);
  }
  return ok({ actor });
}

export function ensureOwnerOrPermission(
  actor: Actor,
  ownerId: string,
  permission: Permission,
): Result<Empty> {
  if (actor.id === ownerId) {
    return ok({});
  }
  return ensurePermission(actor, permission);
}
