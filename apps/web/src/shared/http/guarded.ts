import { type Actor, ensurePermission } from "@/shared/auth/actor";
import type { Permission } from "@/shared/auth/permissions";
import { type CityPageContext, loadCityPage } from "@/shared/http/cityPage";
import type { Empty, Result } from "@/shared/http/errors";
import { presentError } from "@/shared/http/presentError";

/** A loaded city page with a signed-in actor — what a guarded handler receives. */
export type GuardedPage = CityPageContext & { actor: Actor };

export interface Denied {
  allowed: false;
  code: string;
  reason: string;
}
export type Guarded<T> = ({ allowed: true } & T) | Denied;

/**
 * The one route-guard interface for admin server fns: loads the city page,
 * requires a signed-in actor, checks the permission (when given), runs the
 * handler, and maps any Err into the `{ allowed: false, code, reason }` shape
 * the client's DeniedCard already understands (`reason` is now the
 * human-presented message from `presentError`, `code` is the machine code).
 */
export async function guarded<T extends object>(
  citySlug: string,
  permission: Permission | null,
  fn: (page: GuardedPage) => Promise<Result<T>>,
): Promise<Guarded<T>> {
  const page = await loadCityPage(citySlug);
  if (!page.ok) {
    return { allowed: false, code: page.error.code, reason: presentError(page.error) };
  }
  if (!page.actor) {
    const error = { code: "unauthenticated", status: 401 };
    return { allowed: false, code: error.code, reason: presentError(error) };
  }
  if (permission) {
    const perm = ensurePermission(page.actor, permission);
    if (!perm.ok) {
      return { allowed: false, code: perm.error.code, reason: presentError(perm.error) };
    }
  }
  const result = await fn({ ...page, actor: page.actor });
  if (!result.ok) {
    return { allowed: false, code: result.error.code, reason: presentError(result.error) };
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
    return { error: presentError({ code: "unauthenticated", status: 401 }), ok: false };
  }
  if (permission) {
    const perm = ensurePermission(page.actor, permission);
    if (!perm.ok) {
      return { error: presentError(perm.error), ok: false };
    }
  }
  const result = await fn({ ...page, actor: page.actor });
  if (!result.ok) {
    return { error: presentError(result.error), ok: false };
  }
  const { ok: _ok, ...payload } = result;
  return { ok: true, ...(payload as T) };
}
