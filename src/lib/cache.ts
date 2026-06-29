// Simple in-memory cache with TTL for serverless functions
// Each function instance has its own cache that persists across requests.
//
// Keys are TENANT-SCOPED: `cached()` prefixes every key with the current
// tenantId so a value cached for tenant A can never be served to tenant B
// (docs/multi-tenancy-isolation-spec.md §3 — cache bleed). Fail-closed: the
// tenant is resolved via getTenantId(), which throws outside a tenant scope,
// so a cache entry is never written under an ambiguous key.
import { getTenantId } from "@/lib/tenant-context";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 60,
): Promise<T> {
  const tenantId = await getTenantId();
  const scopedKey = `${tenantId}:${key}`;
  const now = Date.now();
  const entry = cache.get(scopedKey) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const data = await fn();
  cache.set(scopedKey, {
    data,
    expiresAt: now + ttlSeconds * 1000,
  });

  return data;
}

export function invalidateCache(keyPattern?: string): void {
  if (!keyPattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.includes(keyPattern)) {
      cache.delete(key);
    }
  }
}
