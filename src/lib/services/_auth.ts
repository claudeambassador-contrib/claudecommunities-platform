/**
 * Auth helpers used by every service. Services accept an already-resolved
 * `User` so they're transport-agnostic — the route adapter calls
 * `ensureUserInDb()` (or MCP's `getDbUser`) and passes the result in.
 *
 * These helpers throw ServiceError so adapters get a uniform mapping.
 */
import { ensureUserInDb } from "@/lib/auth";
import {
  getActorPermissions,
  hasAnyAdminPermission,
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import { ServiceError } from "./_errors";

/**
 * Actor passed to every service call.
 *
 * `permissions` is the parsed permission list for the user's `role` — loaded
 * once by `requireSessionUser`/`actorFromUser`. Services should call
 * `ensurePermission(actor, ...)` rather than touching `actor.role` directly.
 */
export interface ActorLike {
  id: string;
  role: string;
  permissions?: readonly Permission[];
}

/**
 * Used by route adapters: resolves the current Clerk session into a DB user,
 * loads the matching role's permissions, and throws 401 if unauthenticated.
 * MCP tools should keep their own auth-info resolution and call
 * `actorFromUser` directly.
 */
export async function requireSessionUser() {
  const user = await ensureUserInDb();
  if (!user) {
    throw new ServiceError("unauthenticated", "Not signed in");
  }
  // Permissions come from the URL-tenant MEMBERSHIP role, never the global
  // User.role (see getMembershipPermissions). A non-member resolves to [].
  const { permissions } = await getActorPermissions(user.id);
  return Object.assign(user, { permissions });
}

/**
 * Lift a DB user (or any `{id, role}` pair) into an ActorLike with
 * permissions populated. Use this from MCP tools or anywhere else that
 * already has a user record in hand.
 */
export async function actorFromUser<T extends { id: string; role: string }>(
  user: T,
): Promise<T & { permissions: readonly Permission[] }> {
  // Membership-based — the passed `user.role` (global) is NOT used for authz.
  // Callers in non-request contexts (MCP) must establish the tenant first
  // (runWithTenant), else getActorPermissions throws (fail-closed).
  const { permissions } = await getActorPermissions(user.id);
  return Object.assign(user, { permissions });
}

/**
 * Legacy gate — kept so old callsites compile during the sweep. Now treats
 * "admin access" as "has any admin permission at all" (i.e. any non-member
 * role). New code should use `ensurePermission(actor, "x.y")`.
 */
export function ensureAdmin(actor: ActorLike): void {
  if (!hasAnyAdminPermission(actor)) {
    throw new ServiceError("forbidden", "Admin access required");
  }
}

export function ensurePermission(actor: ActorLike, permission: Permission): void {
  if (!hasPermission(actor, permission)) {
    throw new ServiceError("forbidden", `Missing permission: ${permission}`);
  }
}

export function ensureOwner(actor: ActorLike, ownerId: string): void {
  if (actor.id !== ownerId && !hasAnyAdminPermission(actor)) {
    throw new ServiceError("forbidden", "Not allowed");
  }
}

/**
 * Owner-or-permission gate: allows the resource owner OR anyone holding the
 * given admin permission. Replaces the older `ensureOwner` for cases where
 * the admin override should require a specific capability rather than just
 * "any admin permission".
 */
export function ensureOwnerOrPermission(
  actor: ActorLike,
  ownerId: string,
  permission: Permission,
): void {
  if (actor.id === ownerId) return;
  if (hasPermission(actor, permission)) return;
  throw new ServiceError("forbidden", "Not allowed");
}
