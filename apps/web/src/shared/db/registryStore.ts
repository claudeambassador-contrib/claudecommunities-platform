import type { RegistryDb } from "./client";
import { createRegistrySchema, type RegistryTables } from "./registrySchema";

/**
 * Global-plane database handle (tenants, identity, Impact Lab).
 * No orgId — this plane is not city-scoped.
 */
export interface RegistryStore {
  readonly db: RegistryDb;
  readonly tables: RegistryTables;
}

const tableCache = createRegistrySchema();

export function registryStore(db: RegistryDb): RegistryStore {
  return {
    db,
    tables: tableCache,
  };
}
