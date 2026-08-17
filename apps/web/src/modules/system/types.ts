import type { Actor } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";

export interface McpToolInfo {
  description: string;
  name: string;
}

export interface McpDispatchContext {
  actor: Actor;
  openTenant: (citySlug: string) => Promise<TenantStore> | TenantStore;
}

export type McpArgs = Record<string, unknown>;
