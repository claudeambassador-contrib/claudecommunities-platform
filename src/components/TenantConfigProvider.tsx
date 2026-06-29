"use client";

/**
 * Client-side access to the current tenant's config.
 *
 * Server code reads `await getTenantConfig()` (a registry DB read). Client
 * components can't await, so the root layout resolves the config + tenant slug
 * once on the server and seeds them here; client components read them
 * synchronously via `useTenantConfig()` / `useTenantId()`. This is the client
 * successor to the build-inlined `getRegionConfig()` / `REGION` from region.ts.
 */
import { createContext, type ReactNode, useContext } from "react";
import type { TenantConfig } from "@/lib/tenant-config";

interface TenantContextValue {
  config: TenantConfig;
  tenantId: string;
}

const TenantConfigContext = createContext<TenantContextValue | null>(null);

export function TenantConfigProvider({
  config,
  tenantId,
  children,
}: {
  config: TenantConfig;
  tenantId: string;
  children: ReactNode;
}) {
  return (
    <TenantConfigContext.Provider value={{ config, tenantId }}>
      {children}
    </TenantConfigContext.Provider>
  );
}

/** The current tenant's config (client). Must be rendered under the provider. */
export function useTenantConfig(): TenantConfig {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) {
    throw new Error("useTenantConfig must be used within a <TenantConfigProvider>");
  }
  return ctx.config;
}

/** The current tenant's slug (client) — the successor to the build-inlined REGION. */
export function useTenantId(): string {
  const ctx = useContext(TenantConfigContext);
  if (!ctx) {
    throw new Error("useTenantId must be used within a <TenantConfigProvider>");
  }
  return ctx.tenantId;
}
