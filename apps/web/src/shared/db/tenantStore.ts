import type { TenantDb } from "./client";
import { createTenantSchema, type TenantTables } from "./tenantSchema";

/**
 * A city instance's database handle bound to its orgId.
 *
 * Isolation is physical (one D1 per city). orgId is defense-in-depth so a
 * wrong-binding bug cannot silently read/write another city's logical rows.
 */
export interface TenantStore {
  readonly db: TenantDb;
  readonly orgId: string;
  readonly binding: string;
  readonly tables: TenantTables;
}

const tableCache = createTenantSchema();

export function tenantStore(
  db: TenantDb,
  args: { orgId: string; binding: string },
): TenantStore {
  return {
    db,
    orgId: args.orgId,
    binding: args.binding,
    tables: tableCache,
  };
}

export function storeFrom(ctx: {
  tenant: { orgId: string; d1Binding: string };
  tenantDb: TenantDb;
}): TenantStore {
  return tenantStore(ctx.tenantDb, {
    orgId: ctx.tenant.orgId,
    binding: ctx.tenant.d1Binding,
  });
}
