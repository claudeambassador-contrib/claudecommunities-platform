import type { Permission } from "@/shared/auth/permissions";
import type { RegistryDb, TenantDb } from "@/shared/db/client";

export interface TenantContext {
  d1Binding: string;
  d1DatabaseId: string;
  hostname: string | null;
  id: string;
  name: string;
  orgId: string;
  r2Prefix: string;
  region: "au" | "nz";
  slug: string;
  status: "active" | "suspended" | "archived";
  timezone: string;
}

export interface AuthContext {
  clerkUserId: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: ReadonlySet<Permission>;
  role: "owner" | "admin" | "member" | null;
  userId: string;
}

export interface RouteContext {
  auth: AuthContext | null;
  registryDb: RegistryDb;
  tenant: TenantContext;
  tenantDb: TenantDb;
}
