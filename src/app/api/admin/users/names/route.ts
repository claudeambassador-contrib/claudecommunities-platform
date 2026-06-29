import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listNamesAdmin } from "@/lib/services/users";

// Synthetic cache key — never reached by user requests. Auth runs before any
// cache lookup, so non-admins can't read cached data even if they hit this route.
const CACHE_KEY = "https://cache.internal/admin-users-names";
const CACHE_TTL_SECONDS = 300;

export const GET = withService(async () => {
  const user = await requireSessionUser();

  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (edgeCache) {
    const hit = await edgeCache.match(CACHE_KEY);
    if (hit) return hit;
  }

  const data = await listNamesAdmin(user);
  const res = NextResponse.json(data, {
    headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
  });
  if (edgeCache) {
    await edgeCache.put(CACHE_KEY, res.clone());
  }
  return res;
});
