// Cache invalidation helpers for the OpenNext incremental cache.
//
// `unstable_cache(...)` entries (see `src/app/community/page.tsx`) and ISR
// pages (`/events`, `/courses`, `/cities/[slug]`) are refreshed on-demand by
// these calls from the service-layer write paths — this is the "update the
// cache when things get added" half of the read-cache strategy.
//
// `revalidateTag` / `revalidatePath` are only valid inside a Next request
// scope (route handlers, server actions, MCP tool calls). Some write paths
// also run from non-request contexts (Workflows, cron `scheduled()`), where
// these throw "static generation store missing". The `*Safe` wrappers swallow
// that so a background writer never crashes on a best-effort cache nudge — the
// time-based `revalidate` window is the backstop.

import { revalidatePath, revalidateTag } from "next/cache";

/** Cache tags. Keep in sync with the `tags` passed to `unstable_cache(...)`. */
export const CACHE_TAGS = {
  /** Anything keyed off the post set: feed counts, trending posts. */
  posts: "posts",
  /** Anything keyed off events: upcoming-event count, the /events list. */
  events: "events",
} as const;

export function revalidateTagSafe(tag: string): void {
  try {
    // Next 16 requires a cacheLife profile; "max" = stale-while-revalidate
    // (serve stale immediately, refresh in the background) — the right fit for
    // "stale-by-seconds is fine".
    revalidateTag(tag, "max");
  } catch (error) {
    console.warn(`[revalidate] tag "${tag}" skipped (no request scope):`, error);
  }
}

export function revalidatePathSafe(path: string, type?: "page" | "layout"): void {
  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
  } catch (error) {
    console.warn(`[revalidate] path "${path}" skipped (no request scope):`, error);
  }
}
