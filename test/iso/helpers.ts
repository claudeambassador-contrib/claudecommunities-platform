import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { tenantScope } from "@/lib/tenant-scope";

let n = 0;

/** A scoped client exactly as getPrisma() builds it. */
export function scoped(base: PrismaClient, tenantId: string) {
  return base.$extends(tenantScope(tenantId, base as never));
}

/**
 * The scoped client injects tenantId on create at RUNTIME, but the generated
 * create-input TYPE still lists tenantId as required. `d()` strips only the
 * compile-time requirement — the runtime object is unchanged, so tests still
 * prove the extension does the injection.
 */
export function d<T>(data: T): T & { tenantId: string } {
  return data as T & { tenantId: string };
}

/**
 * A fresh, isolated SQLite-backed base PrismaClient with the full schema. Each
 * call gets its own DB file so suites don't cross-contaminate. The chokepoint
 * is applied on top via `base.$extends(tenantScope(id))` in the tests — exactly
 * as `getPrisma()` does in the app.
 */
export function freshDb(): { base: PrismaClient; cleanup: () => void } {
  const ddl = readFileSync(resolve(import.meta.dirname, ".schema.sql"), "utf-8");
  const file = `/tmp/iso-${process.pid}-${n++}.db`;
  const raw = new Database(file);
  raw.exec(ddl);
  raw.close();
  const adapter = new PrismaBetterSqlite3({ url: `file:${file}` });
  const base = new PrismaClient({ adapter });
  return {
    base,
    cleanup: () => {
      void base.$disconnect();
      try {
        rmSync(file, { force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

/** A user (global identity) created directly on the base client. */
export async function seedUser(base: PrismaClient, id: string, email: string) {
  return base.user.create({ data: { id, clerkId: `clerk_${id}`, email, name: id } });
}

/** Seed a tenant registry row + an owner membership. */
export async function seedTenant(base: PrismaClient, slug: string, ownerUserId: string) {
  await base.tenant.create({ data: { slug, name: slug.toUpperCase(), status: "active" } });
  await base.userTenant.create({ data: { tenantId: slug, userId: ownerUserId, role: "owner" } });
}
