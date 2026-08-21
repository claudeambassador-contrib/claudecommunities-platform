import type { TenantDb } from "./client";
import { createTenantSchema } from "./tenantSchema";
import type { TenantTables } from "./tenantSchema";

/**
 * A city instance's database handle bound to its orgId.
 *
 * Isolation is physical (one D1 per city). orgId is defense-in-depth so a
 * wrong-binding bug cannot silently read/write another city's logical rows.
 */
export interface TenantStore {
  readonly binding: string;
  readonly db: TenantDb;
  readonly orgId: string;
  readonly tables: TenantTables;
}

const tableCache = createTenantSchema();

export function tenantStore(db: TenantDb, args: { orgId: string; binding: string }): TenantStore {
  return {
    binding: args.binding,
    db,
    orgId: args.orgId,
    tables: tableCache,
  };
}

export function storeFrom(ctx: {
  tenant: { orgId: string; d1Binding: string };
  tenantDb: TenantDb;
}): TenantStore {
  return tenantStore(ctx.tenantDb, {
    binding: ctx.tenant.d1Binding,
    orgId: ctx.tenant.orgId,
  });
}
