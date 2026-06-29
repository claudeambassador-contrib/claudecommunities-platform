// D1-only Prisma client + the multi-tenant access layer.
//
// We use `@prisma/client/edge` semantics because that entry loads the WASM
// query compiler via a real `import('...wasm')` statement that Workers' bundler
// turns into a WASM binding. The default `@prisma/client` entry decodes WASM
// from a base64 string and calls `new WebAssembly.Module(...)`, which Workers
// blocks ("Wasm code generation disallowed by embedder").
//
// On Workers each request has its own I/O context — a global singleton causes
// "Cannot perform I/O on behalf of a different request". So we build a fresh
// client per request, memoized on the request `ExecutionContext` (`ctx`) via a
// WeakMap: one base client within a request, fresh across requests, GC'd when
// the request ends.
//
// ── Multi-tenant access layer (docs/multi-tenancy-isolation-spec.md §2) ──────
//   getPrisma(tenantId?)   — SCOPED client. Every operation is bound to the
//                            tenant (resolved from context if not passed) via
//                            the `tenantScope` $extends chokepoint. Use this for
//                            ALL feature data access.
//   getPlatformPrisma()    — UNSCOPED client. Registry/membership resolution and
//                            the platform-admin plane only. Every call reviewed.
//   withTenant(slug, fn)   — audited escape hatch: run `fn(scopedClient)` inside
//                            an explicit tenant scope (platform loops, cron).
//   default export `prisma`— UNSCOPED, lazy proxy. DEPRECATED legacy surface
//                            kept so existing importers compile during the
//                            migration; feature code moves to getPrisma().

import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import { getTenantId, runWithTenant } from "@/lib/tenant-context";
import { tenantScope } from "@/lib/tenant-scope";

// One base (unscoped) client per request ctx.
const baseByCtx = new WeakMap<object, PrismaClient>();
// Scoped clients per (request ctx, tenantId). A scoped wrapper is NEVER shared
// across tenants (§2.1 #3) — the map is keyed by tenantId within a ctx.
const scopedByCtx = new WeakMap<object, Map<string, ScopedClient>>();

export type ScopedClient = ReturnType<typeof buildScoped>;

async function resolveCtx(): Promise<{ env: Record<string, unknown>; key?: object }> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = await getCloudflareContext({ async: true });
    return {
      env: cf.env as Record<string, unknown>,
      key: (cf.ctx as object | undefined) ?? undefined,
    };
  } catch {
    // Not in a request scope (e.g. a Workflow) — fall back to the ALS env that
    // `runWithEnv` populates. No `ctx` here, so no memoization.
    const { getEnvAsync } = await import("@/lib/cf-env");
    return { env: (await getEnvAsync()) as unknown as Record<string, unknown> };
  }
}

function buildBase(env: Record<string, unknown>): PrismaClient {
  const adapter = new PrismaD1(env.DB as never);
  return new PrismaClient({ adapter });
}

function getOrBuildBase(env: Record<string, unknown>, key?: object): PrismaClient {
  if (key) {
    const existing = baseByCtx.get(key);
    if (existing) return existing;
  }
  const client = buildBase(env);
  if (key) baseByCtx.set(key, client);
  return client;
}

function buildScoped(base: PrismaClient, tenantId: string) {
  return base.$extends(tenantScope(tenantId, base as never));
}

/**
 * The tenant-SCOPED Prisma client. Pass an explicit `tenantId` (slug) from a
 * resolved context (cron/workflow/withTenant), or omit it to resolve the
 * current request/ALS tenant via {@link getTenantId} (fail-closed: throws if no
 * tenant is in scope). Every model operation is filtered/stamped with the
 * tenant by the `tenantScope` chokepoint.
 */
export async function getPrisma(tenantId?: string): Promise<ScopedClient> {
  const tid = tenantId ?? (await getTenantId());
  const { env, key } = await resolveCtx();
  const base = getOrBuildBase(env, key);

  if (!key) return buildScoped(base, tid); // off-request (workflow): no memo

  let perTenant = scopedByCtx.get(key);
  if (!perTenant) {
    perTenant = new Map();
    scopedByCtx.set(key, perTenant);
  }
  let scoped = perTenant.get(tid);
  if (!scoped) {
    scoped = buildScoped(base, tid);
    perTenant.set(tid, scoped);
  }
  return scoped;
}

/**
 * The UNSCOPED platform client. For the tenant registry / membership resolution
 * and the platform-admin plane ONLY — it does not filter by tenant. Every call
 * site must be deliberate and reviewed (ESLint restricts it to platform modules
 * in the fan-out).
 */
export async function getPlatformPrisma(): Promise<PrismaClient> {
  const { env, key } = await resolveCtx();
  return getOrBuildBase(env, key);
}

/**
 * Audited escape hatch: run `fn` with a client scoped to `slug`, inside an
 * explicit tenant ALS scope so any nested `getPrisma()`/`getTenantId()` also
 * resolves to `slug`. For platform loops over tenants and cron drains.
 */
export async function withTenant<T>(
  slug: string,
  fn: (db: ScopedClient) => Promise<T>,
): Promise<T> {
  return runWithTenant(slug, async () => fn(await getPrisma(slug)));
}

// ── Legacy unscoped default export ──────────────────────────────────────────
// A lazy proxy preserving the `prisma.user.findMany(...)` API. UNSCOPED — kept
// only so the ~100 existing importers compile while they migrate to getPrisma().
// New feature code must NOT use this.
async function createD1Client(): Promise<PrismaClient> {
  const { env, key } = await resolveCtx();
  return getOrBuildBase(env, key);
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "then") return undefined;

    if (typeof prop === "string" && prop.startsWith("$")) {
      return async (...args: unknown[]) => {
        const client = await createD1Client();
        const fn = (client as unknown as Record<string, (...a: unknown[]) => unknown>)[prop];
        return fn.apply(client, args);
      };
    }

    return new Proxy(
      {},
      {
        get(_modelTarget, methodName) {
          if (methodName === "then") return undefined;
          return async (...args: unknown[]) => {
            const client = await createD1Client();
            const model = (
              client as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>
            )[prop as string];
            return model[methodName as string](...args);
          };
        },
      },
    );
  },
});

export { prisma };
export default prisma;
