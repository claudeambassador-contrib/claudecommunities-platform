import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";

import { createRegistrySchema } from "./registrySchema";
import { createTenantSchema } from "./tenantSchema";

export type RegistryDb = ReturnType<typeof createRegistryDb>;
export type TenantDb = ReturnType<typeof createTenantDb>;

export function createRegistryDb(d1: D1Database) {
  return drizzle(d1, { schema: createRegistrySchema() });
}

export function createTenantDb(d1: D1Database) {
  return drizzle(d1, { schema: createTenantSchema() });
}

/** Binding name → D1Database from Worker env. */
export function getD1Binding(env: Record<string, unknown>, binding: string): D1Database {
  const value = env[binding];
  if (!value || typeof value !== "object") {
    throw new Error(`Missing D1 binding: ${binding}`);
  }
  return value as D1Database;
}
