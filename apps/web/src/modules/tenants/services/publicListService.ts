import { getRegistryDb } from "@/shared/db/env";
import { err, ok, type Result } from "@/shared/http/errors";
import * as tenantsRepo from "@/modules/tenants/repositories/tenantsRepository";
import { generateOrgId, newId, nowMs, toD1Binding, toSafeSlug } from "@/shared/ids";
import type { TenantContext } from "@/shared/http/routeContext";
import type { TenantRow } from "@/modules/tenants/schema.registry";
import { tenantSettings } from "@/modules/tenants/schema.registry";

export type ProvisionCityInput = {
  slug: string;
  name: string;
  region?: "au" | "nz";
  timezone?: string;
  hostname?: string | null;
  d1DatabaseId?: string;
  listed?: boolean;
};

function toContext(row: TenantRow): TenantContext {
  return {
    id: row.id,
    orgId: row.orgId,
    slug: row.slug,
    name: row.name,
    hostname: row.hostname,
    d1Binding: row.d1Binding,
    d1DatabaseId: row.d1DatabaseId,
    r2Prefix: row.r2Prefix,
    status: row.status,
    region: row.region,
    timezone: row.timezone,
  };
}

/**
 * Register a city tenant in REGISTRY.
 * Caller must create the D1 + apply tenant migrations + regenerate wrangler
 * so `d1Binding` exists on the Worker before traffic hits the city.
 */
export async function provisionCity(
  input: ProvisionCityInput,
): Promise<Result<{ tenant: TenantContext }>> {
  const slug = toSafeSlug(input.slug);
  if (!slug) return err("invalid_slug", 400, "Slug is required");

  const db = getRegistryDb();
  const existing = await tenantsRepo.findBySlug(db, slug);
  if (existing) return err("slug_taken", 409, `City ${slug} already exists`);

  const now = new Date(nowMs());
  const orgId = generateOrgId();
  const d1Binding = toD1Binding(slug);
  const row = await tenantsRepo.insertTenant(db, {
    id: newId("ten"),
    orgId,
    slug,
    name: input.name.trim() || slug,
    hostname: input.hostname ?? null,
    d1Binding,
    d1DatabaseId: input.d1DatabaseId ?? `pending-${slug}`,
    r2Prefix: `tenants/${slug}`,
    status: "active",
    listed: input.listed ?? true,
    region: input.region ?? "au",
    timezone: input.timezone ?? "Australia/Sydney",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(tenantSettings).values({
    id: newId("tset"),
    orgId,
    configJson: "{}",
    createdAt: now,
    updatedAt: now,
  });

  return ok({ tenant: toContext(row) });
}

export async function listPublicTenants(): Promise<
  Result<{ tenants: { slug: string; name: string }[] }>
> {
  try {
    const db = getRegistryDb();
    const rows = await tenantsRepo.listListed(db);
    return ok({
      tenants: rows.map((r) => ({ slug: r.slug, name: r.name })),
    });
  } catch {
    // Local/dev without D1 migrated yet
    return ok({ tenants: [] });
  }
}

export async function resolveCityContext(
  slug: string,
): Promise<Result<{ tenant: TenantContext }>> {
  try {
    const db = getRegistryDb();
    const row = await tenantsRepo.findBySlug(db, toSafeSlug(slug));
    if (!row) return err("not_found", 404);
    if (row.status === "suspended") return err("suspended", 503);
    if (row.status === "archived") return err("not_found", 404);
    return ok({ tenant: toContext(row) });
  } catch (e) {
    return err("registry_unavailable", 503, e instanceof Error ? e.message : undefined);
  }
}
