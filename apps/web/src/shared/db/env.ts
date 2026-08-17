import { env } from "cloudflare:workers";
import { createRegistryDb, createTenantDb, getD1Binding } from "./client";
import type { TenantContext } from "@/shared/http/routeContext";
import { tenantStore, type TenantStore } from "./tenantStore";

/** Worker env as a loose record for D1 binding lookups. */
export function workerEnv(): Record<string, unknown> {
  return env as unknown as Record<string, unknown>;
}

export function getRegistryDb() {
  const e = workerEnv();
  return createRegistryDb(getD1Binding(e, "REGISTRY"));
}

export function openTenantStore(tenant: Pick<TenantContext, "orgId" | "d1Binding">): TenantStore {
  const e = workerEnv();
  const d1 = getD1Binding(e, tenant.d1Binding);
  return tenantStore(createTenantDb(d1), {
    orgId: tenant.orgId,
    binding: tenant.d1Binding,
  });
}

export function getStorageBucket(): R2Bucket | null {
  const bucket = workerEnv().STORAGE;
  return bucket && typeof bucket === "object" ? (bucket as R2Bucket) : null;
}
