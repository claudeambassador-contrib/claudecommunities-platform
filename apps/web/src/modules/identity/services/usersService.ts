// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as directoryRepo from "@/modules/identity/repositories/directoryRepository";
import type { ListUsersOptions, UserProfile, UserSummary } from "@/modules/identity/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { RegistryStore } from "@/shared/db/registryStore";
import { err, ok, type Result } from "@/shared/http/errors";

function clampPage(options: ListUsersOptions): { limit: number; offset: number; search?: string } {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const search = options.search?.trim() || undefined;
  return { limit, offset, search };
}

export async function listUsers(
  store: RegistryStore,
  actor: Actor,
  orgId: string,
  options: ListUsersOptions = {},
): Promise<Result<{ users: UserSummary[] }>> {
  const perm = ensurePermission(actor, "users.view");
  if (!perm.ok) {
    return perm;
  }
  if (!orgId) {
    return err("bad_request", 400, "orgId is required");
  }
  return ok({ users: await directoryRepo.listOrgMembers(store, orgId, clampPage(options)) });
}

export async function getOwnProfile(
  store: RegistryStore,
  actor: Actor,
): Promise<Result<{ user: UserProfile }>> {
  const user = await directoryRepo.findUserById(store, actor.id);
  if (!user) {
    return err("not_found", 404, "User not found");
  }
  return ok({ user });
}
