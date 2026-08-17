import type { RegistryDb, TenantDb } from "@/shared/db/client";
import type { Permission } from "@/shared/auth/permissions";

export type TenantContext = {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  hostname: string | null;
  d1Binding: string;
  d1DatabaseId: string;
  r2Prefix: string;
  status: "active" | "suspended" | "archived";
  region: "au" | "nz";
  timezone: string;
};

export type AuthContext = {
  userId: string;
  clerkUserId: string;
  email: string;
  role: "owner" | "admin" | "member" | null;
  isSuperAdmin: boolean;
  permissions: ReadonlySet<Permission>;
};

export type RouteContext = {
  registryDb: RegistryDb;
  tenantDb: TenantDb;
  tenant: TenantContext;
  auth: AuthContext | null;
};
