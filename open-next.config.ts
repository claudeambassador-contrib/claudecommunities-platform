import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// Read-side cache to cut Worker CPU. With `enableCacheInterception` a cached
// route is served WITHOUT booting NextServer or running the React render —
// that's the CPU win. ISR pages and `unstable_cache(...)` data both persist in
// the R2 store; `revalidateTag`/`revalidatePath` (see `src/lib/revalidate.ts`)
// invalidate on writes via the D1 tag cache.
//
// Requires these bindings in wrangler.jsonc (base + each env):
//   - r2_buckets: NEXT_INC_CACHE_R2_BUCKET   (cached page/data payloads)
//   - d1_databases: NEXT_TAG_CACHE_D1        (tag → revalidation timestamps)
//   - services: WORKER_SELF_REFERENCE        (worker re-invokes itself to revalidate)
// See docs/cloudflare-cpu-optimization.md for the provisioning commands.
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    // Pull the cached payload into the colo-local Cache API so reads after the
    // first in a region don't round-trip to R2 (closes KV's read-latency gap).
    mode: "long-lived",
    shouldLazilyUpdateOnCacheHit: true,
  }),
  tagCache: d1NextTagCache,
  // Time-based ISR pages (revalidate=300 on /events, /courses, /cities/[slug])
  // enqueue a background revalidation when they go stale. Without a real queue
  // OpenNext's default no-op queue throws "Dummy queue is not implemented" at
  // runtime. The Durable Object queue dedups and runs them off the request
  // path. Needs the NEXT_CACHE_DO_QUEUE DO binding + migration in
  // wrangler.jsonc; the DOQueueHandler class is auto-exported by OpenNext's
  // generated worker.js, and its constructor reuses WORKER_SELF_REFERENCE.
  queue: doQueue,
  enableCacheInterception: true,
});
