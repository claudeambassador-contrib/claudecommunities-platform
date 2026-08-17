import { listFeed } from "@/modules/community/services/communityService";
import type { PostDetail } from "@/modules/community/types";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";
import { openTenantStore } from "@/shared/db/env";
import type { Result } from "@/shared/http/errors";

export async function listPosts(citySlug: string): Promise<Result<{ posts: PostDetail[] }>> {
  const city = await resolveCityContext(citySlug);
  if (!city.ok) {
    return city;
  }
  return listFeed(openTenantStore(city.tenant));
}
