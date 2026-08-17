import { listPosts } from "@/modules/social/services/socialService";
import type { Actor } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { ok, type Result } from "@/shared/http/errors";

export async function countScheduled(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ count: number }>> {
  const listed = await listPosts(store, actor, { status: ["scheduled"] });
  if (!listed.ok) {
    return listed;
  }
  return ok({ count: listed.posts.length });
}
