import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Actor } from "@/shared/auth/actor";
import { permissionsForRole } from "@/shared/auth/permissions";
import { createTenantSchema } from "@/shared/db/tenantSchema";
import { type TenantStore, tenantStore } from "@/shared/db/tenantStore";

export function openMemoryTenant(orgId = "org_test"): TenantStore {
  const sqlite = new Database(":memory:");
  const dir = resolve(import.meta.dirname, "../../drizzle/tenant");
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(join(dir, file), "utf8"));
  }
  return tenantStore(drizzle(sqlite, { schema: createTenantSchema() }) as never, {
    binding: "TENANT_TEST",
    orgId,
  });
}

export function ownerActor(overrides: Partial<Actor> = {}): Actor {
  return {
    email: "owner@example.com",
    id: "usr_owner",
    name: "Owner",
    permissions: permissionsForRole("owner"),
    ...overrides,
  };
}

export function adminActor(overrides: Partial<Actor> = {}): Actor {
  return {
    email: "admin@example.com",
    id: "usr_admin",
    name: "Admin",
    permissions: permissionsForRole("admin"),
    ...overrides,
  };
}

export function memberActor(overrides: Partial<Actor> = {}): Actor {
  return {
    email: "member@example.com",
    id: "usr_member",
    name: "Member",
    permissions: permissionsForRole("member"),
    ...overrides,
  };
}
