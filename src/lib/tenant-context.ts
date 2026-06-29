/**
 * Tenant context — the single place the rest of the app asks "which tenant is
 * this?". See `docs/multi-tenancy-isolation-spec.md` §1.
 *
 * The tenant id IS the tenant's slug (a short immutable label such as `au`,
 * `nz`, or a community slug). It is resolved **exactly once per request, from
 * the URL/host**, by `src/middleware.ts`, which validates it against the
 * `Tenant` registry and stamps it as the internal `x-tenant-id` header (after
 * stripping any client-supplied value). Everything downstream reads it here.
 *
 * Two resolution paths:
 *   1. Request (SSR / API / MCP): read the middleware-stamped header via
 *      `headers()`. An ALS scope entered in middleware does NOT survive into the
 *      render pass (see `src/lib/cf-env.ts`), so the header is the source.
 *   2. No request (cron `scheduled()`, Workflows, queue consumers): there is no
 *      header, so the entry point wraps its work in `runWithTenant(tenantId, …)`
 *      and we read it from the AsyncLocalStorage store.
 *
 * Fail closed: `getTenantId()` throws when no tenant is in scope, so a data
 * access that forgot to establish a tenant errors loudly instead of running
 * unscoped.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { TENANT_BASE_HEADER, TENANT_HEADER } from "@/lib/tenant-headers";

// The trusted internal header names live in a dependency-free module so the
// client link helper (`tenant-base.ts` → `TenantBaseProvider`) can import them
// without dragging `node:async_hooks` into the client bundle. Re-exported here
// for the many server call sites that import them from tenant-context.
export { TENANT_BASE_HEADER, TENANT_HEADER };

/**
 * The deploy's home-region tenant slug (`au` / `nz`). During the single-tenant
 * AU/NZ transition (before the `/t/[tenant]` route restructure) the apex, MCP,
 * and any other non-tenant-routed-but-single-tenant surface resolve to this.
 * Interim — superseded by real per-request resolution at Step 2.
 */
export const HOME_TENANT = (
  process.env.HOME_TENANT ??
  process.env.NEXT_PUBLIC_REGION ??
  "au"
).toLowerCase();

const tenantALS = new AsyncLocalStorage<string>();

/**
 * Run `fn` within an explicit tenant scope. Use from every non-request entry
 * point that touches tenant data: the cron `scheduled()` handler (once per
 * live tenant), Workflow `run()` steps (payload carries `tenantId`), and queue
 * consumers (message carries `tenantId`). Nestable and async-safe.
 */
export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  if (!tenantId) throw new Error("runWithTenant called with an empty tenantId");
  return tenantALS.run(tenantId, fn);
}

/** The explicit ALS tenant, if we're inside a `runWithTenant` scope. */
export function getAlsTenant(): string | undefined {
  return tenantALS.getStore();
}

/**
 * Current tenant id (slug), or `null` if none is resolved. Prefers an explicit
 * `runWithTenant` scope; otherwise reads the middleware-stamped request header.
 * Use this only where "no tenant" is a legitimate state (e.g. the platform
 * apex). Feature data access should use {@link getTenantId}.
 */
export async function getTenantIdOrNull(): Promise<string | null> {
  const fromAls = tenantALS.getStore();
  if (fromAls) return fromAls;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get(TENANT_HEADER);
  } catch {
    // No request scope (and no ALS scope) — genuinely no tenant.
    return null;
  }
}

/**
 * Current tenant id (slug). Throws if none is in scope — the fail-closed
 * guarantee that no data access silently runs unscoped. `getPrisma()` calls
 * this, so every scoped query is bound to a real, resolved tenant.
 */
export async function getTenantId(): Promise<string> {
  const id = await getTenantIdOrNull();
  if (!id) {
    throw new Error(
      "No tenant in context. A tenant-scoped data access ran outside a tenant " +
        "request and outside runWithTenant(). This is a fail-closed guard — " +
        "establish the tenant (middleware header or runWithTenant) before querying.",
    );
  }
  return id;
}

/**
 * Build the request headers middleware forwards downstream. THE TRUST BOUNDARY:
 * always strip any client-supplied `x-tenant-id` (it's forgeable — a request can
 * set it directly), then stamp the trusted, server-resolved tenant ONLY when the
 * route isn't selfTenanted. selfTenanted routes (cron/webhooks/MCP/internal) must
 * stay fail-closed: they get NO stamp, so `getTenantId()` throws unless they
 * establish their own scope (`runWithTenant`, HMAC-signed URL, user token). If we
 * skipped the strip on that path, a forged header would defeat fail-closed and
 * silently scope an unwrapped handler to the attacker's tenant.
 */
export function buildTenantHeaders(
  inbound: Headers,
  opts: { tenantSlug: string; selfTenanted: boolean; tenantBase?: string },
): Headers {
  const headers = new Headers(inbound);
  headers.delete(TENANT_HEADER); // strip inbound, ALWAYS — before any stamp
  headers.delete(TENANT_BASE_HEADER); // same trust boundary — also forgeable
  if (!opts.selfTenanted) {
    headers.set(TENANT_HEADER, opts.tenantSlug);
    headers.set(TENANT_BASE_HEADER, opts.tenantBase ?? "");
  }
  return headers;
}
