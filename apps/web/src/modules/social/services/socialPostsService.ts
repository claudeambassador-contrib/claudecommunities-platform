// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as socialRepo from "@/modules/social/repositories/socialRepository";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { ok, type Result } from "@/shared/http/errors";

export async function countScheduled(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ count: number }>> {
  const perm = ensurePermission(actor, "social.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ count: await socialRepo.countByStatus(store, "scheduled") });
}
