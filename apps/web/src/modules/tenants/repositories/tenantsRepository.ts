import { and, eq } from "drizzle-orm";
import { tenants, type TenantRow } from "@/modules/tenants/schema.registry";
import type { RegistryDb } from "@/shared/db/client";

export async function findBySlug(db: RegistryDb, slug: string): Promise<TenantRow | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function findByHostname(
  db: RegistryDb,
  hostname: string,
): Promise<TenantRow | null> {
  const rows = await db.select().from(tenants).where(eq(tenants.hostname, hostname)).limit(1);
  return rows[0] ?? null;
}

export async function listListed(db: RegistryDb): Promise<TenantRow[]> {
  return db
    .select()
    .from(tenants)
    .where(and(eq(tenants.listed, true), eq(tenants.status, "active")));
}

export async function listAll(db: RegistryDb): Promise<TenantRow[]> {
  return db.select().from(tenants);
}

export type InsertTenant = {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  hostname: string | null;
  d1Binding: string;
  d1DatabaseId: string;
  r2Prefix: string;
  status: "active" | "suspended" | "archived";
  listed: boolean;
  region: "au" | "nz";
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function insertTenant(db: RegistryDb, row: InsertTenant): Promise<TenantRow> {
  await db.insert(tenants).values(row);
  const created = await findBySlug(db, row.slug);
  if (!created) throw new Error("Failed to insert tenant");
  return created;
}
