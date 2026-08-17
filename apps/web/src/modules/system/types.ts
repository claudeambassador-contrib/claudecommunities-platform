import type { Actor } from "@/shared/auth/actor";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { TenantStore } from "@/shared/db/tenantStore";

export interface ImageUploadPorts {
  baseUrl: string;
  token: string;
}

export interface McpToolInfo {
  description: string;
  name: string;
}

export interface McpDispatchContext {
  actor: Actor;
  openRegistry?: () => Promise<RegistryStore> | RegistryStore;
  openTenant: (citySlug: string) => Promise<TenantStore> | TenantStore;
  upload?: ImageUploadPorts;
}

export type McpArgs = Record<string, unknown>;
