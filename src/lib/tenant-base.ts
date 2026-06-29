/**
 * Tenant link base — what makes path-prefix tenancy (`host/<slug>/…`) navigable.
 *
 * In HOST-based tenancy (custom domain, subdomain, home) the host carries the
 * tenant across navigation, so internal links stay bare (`/community/feed`) and
 * the base is "". In PATH-PREFIX tenancy the tenant lives in the first path
 * segment, so every in-tenant link must carry it (`/acme/community/feed`) or the
 * very next navigation drops the user into the home tenant — the silent
 * wrong-tenant failure this module exists to prevent.
 *
 * Middleware resolves the base per request and stamps it as `x-tenant-base`
 * (see `buildTenantHeaders`). The app prepends it via `tenantHref()` /
 * `<TenantLink>` / `useTenantRouter()`. The structural test
 * `tenant-links-threaded.test.ts` guarantees no in-tenant link skips this.
 */
import { TENANT_BASE_HEADER } from "@/lib/tenant-headers";
import { isFlatPlatformPath } from "@/lib/tenant-resolve";

/**
 * Prepend the tenant base to a root-absolute INTERNAL href. A no-op when:
 *  - `base` is "" (host-based tenancy — the overwhelmingly common case);
 *  - `href` isn't a root-absolute path (external URL, protocol-relative,
 *    `mailto:`, `#hash`, `?query`, `./relative`);
 *  - `href` targets a FLAT platform route (`/api`, `/login`, `/oauth`, …) —
 *    those are host-level and must stay un-prefixed even under a path tenant;
 *  - `href` is already under `base` (idempotent — safe to double-apply).
 *
 * Pure — used on both server and client.
 */
export function tenantHref(base: string, href: string): string {
  if (!base) return href;
  if (href === "/") return base; // tenant home (`/acme`, not `/acme/`)
  if (!href.startsWith("/") || href.startsWith("//")) return href; // external / relative / hash / query
  if (href === base || href.startsWith(`${base}/`)) return href; // already prefixed (idempotent)
  const path = href.split(/[?#]/, 1)[0]; // flat check ignores ?query / #hash
  if (isFlatPlatformPath(path)) return href; // flat platform route — host-level, never prefixed
  return `${base}${href}`;
}

/**
 * The current request's tenant base ("" host-based, "/<slug>" path-prefix), read
 * from the middleware-stamped header. Server only — client components read it
 * from `TenantBaseProvider` via `useTenantBase()`. Returns "" outside a request.
 */
export async function getTenantBase(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get(TENANT_BASE_HEADER) ?? "";
  } catch {
    return "";
  }
}
