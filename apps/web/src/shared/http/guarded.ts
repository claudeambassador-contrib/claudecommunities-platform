import { type Actor, ensurePermission } from "@/shared/auth/actor";
import type { Permission } from "@/shared/auth/permissions";
import { type CityPageContext, loadCityPage } from "@/shared/http/cityPage";
import type { Empty, Result } from "@/shared/http/errors";

/** A loaded city page with a signed-in actor — what a guarded handler receives. */
export type GuardedPage = CityPageContext & { actor: Actor };

export interface Denied {
  allowed: false;
  reason: string;
}
export type Guarded<T> = ({ allowed: true } & T) | Denied;

/**
 * The one route-guard interface for admin server fns: loads the city page,
 * requires a signed-in actor, checks the permission (when given), runs the
 * handler, and maps any Err into the `{ allowed: false, reason }` shape the
 * client's DeniedCard already understands.
 */
export async function guarded<T extends object>(
  citySlug: string,
  permission: Permission | null,
  fn: (page: GuardedPage) => Promise<Result<T>>,
): Promise<Guarded<T>> {
  const page = await loadCityPage(citySlug);
  if (!page.ok) {
    return { allowed: false, reason: page.error.code };
  }
  if (!page.actor) {
    return { allowed: false, reason: "unauthenticated" };
  }
  if (permission) {
    const perm = ensurePermission(page.actor, permission);
    if (!perm.ok) {
      return { allowed: false, reason: perm.error.code };
    }
  }
  const result = await fn({ ...page, actor: page.actor });
  if (!result.ok) {
    return { allowed: false, reason: result.error.code };
  }
  const { ok: _ok, ...payload } = result;
  return { allowed: true, ...(payload as T) };
}

export type Mutated<T extends object = Empty> = ({ ok: true } & T) | { error: string; ok: false };

/**
 * The mutation twin of `guarded`, for POST server fns: loads the city page,
 * requires a signed-in actor, checks the permission (when given), runs the
 * handler, and maps any Err into the `{ ok: false, error }` shape the
 * existing mutation callers already understand.
 */
export async function guardedMutation<T extends object = Empty>(
  citySlug: string,
  permission: Permission | null,
  fn: (page: GuardedPage) => Promise<Result<T>>,
): Promise<Mutated<T>> {
  const page = await loadCityPage(citySlug);
  if (!(page.ok && page.actor)) {
    return { error: "unauthenticated", ok: false };
  }
  if (permission) {
    const perm = ensurePermission(page.actor, permission);
    if (!perm.ok) {
      return { error: perm.error.message ?? perm.error.code, ok: false };
    }
  }
  const result = await fn({ ...page, actor: page.actor });
  if (!result.ok) {
    return { error: result.error.message ?? result.error.code, ok: false };
  }
  const { ok: _ok, ...payload } = result;
  return { ok: true, ...(payload as T) };
}
