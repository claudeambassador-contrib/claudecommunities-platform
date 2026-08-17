import { openTenantStore } from "@/shared/db/env";
import { err, ok, type Result } from "@/shared/http/errors";
import * as postsRepo from "@/modules/community/repositories/postsRepository";
import {
  buildCityRouteContext,
} from "@/modules/identity/services/sessionService";

export async function listPosts(
  citySlug: string,
): Promise<Result<{ posts: Awaited<ReturnType<typeof postsRepo.listRecent>> }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  const store = openTenantStore(built.ctx.tenant);
  const posts = await postsRepo.listRecent(store);
  return ok({ posts });
}

export async function createPost(
  citySlug: string,
  body: string,
): Promise<Result<{ post: Awaited<ReturnType<typeof postsRepo.insertPost>> }>> {
  const built = await buildCityRouteContext(citySlug);
  if (!built.ok) return built;
  if (!built.ctx.auth) return err("unauthenticated", 401);
  const store = openTenantStore(built.ctx.tenant);
  const post = await postsRepo.insertPost(store, {
    authorUserId: built.ctx.auth.userId,
    body: body.trim(),
  });
  return ok({ post });
}
