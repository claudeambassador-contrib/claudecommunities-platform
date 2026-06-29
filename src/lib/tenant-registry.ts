/**
 * Registry resolution for middleware — slug/custom-domain → tenant, via the
 * UNSCOPED platform client, cached in-isolate (~30s) so it isn't a per-request
 * DB hit (`docs/multi-tenancy-isolation-spec.md` §1.1). This is the only
 * pre-tenant DB read.
 */
import { getPlatformPrisma } from "@/lib/prisma";

export interface TenantInfo {
  slug: string;
  status: string; // "active" | "suspended" | "pending"
}

const TTL_MS = 30_000;
const cache = new Map<string, { value: TenantInfo | null; exp: number }>();

async function memo(
  key: string,
  fetch: () => Promise<TenantInfo | null>,
): Promise<TenantInfo | null> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return hit.value;
  const value = await fetch();
  cache.set(key, { value, exp: now + TTL_MS });
  return value;
}

/** Resolve a tenant by custom domain (host). Returns null for an unknown host. */
export async function resolveTenantByDomain(host: string): Promise<TenantInfo | null> {
  return memo(`d:${host}`, async () => {
    const db = await getPlatformPrisma();
    return db.tenant.findUnique({
      where: { customDomain: host },
      select: { slug: true, status: true },
    });
  });
}

/**
 * Resolve a tenant by slug — used by subdomain (`acme.host`) and, behind a flag,
 * path-prefix (`host/acme`) routing. Returns null for an unknown slug, which
 * middleware maps back to the home tenant. Same in-isolate cache as the domain
 * lookup (key namespaced `s:` so it can't collide with a `d:` host key).
 */
export async function resolveTenantBySlug(slug: string): Promise<TenantInfo | null> {
  return memo(`s:${slug}`, async () => {
    const db = await getPlatformPrisma();
    return db.tenant.findUnique({
      where: { slug },
      select: { slug: true, status: true },
    });
  });
}

/** Clear the in-isolate cache — call after provisioning so a new tenant resolves immediately. */
export function clearTenantRegistryCache(): void {
  cache.clear();
}
