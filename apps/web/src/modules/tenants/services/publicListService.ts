import {
  findBySlug,
  insertTenant,
  listListed,
} from "@/modules/tenants/repositories/tenantsRepository";
import type { TenantRow } from "@/modules/tenants/schema.registry";
import { tenantSettings } from "@/modules/tenants/schema.registry";
import { getRegistryDb } from "@/shared/db/env";
import { err, ok, type Result } from "@/shared/http/errors";
import type { TenantContext } from "@/shared/http/routeContext";
import { generateOrgId, newId, nowMs, toD1Binding, toSafeSlug } from "@/shared/ids";

export interface ProvisionCityInput {
  d1DatabaseId?: string;
  hostname?: string | null;
  listed?: boolean;
  name: string;
  region?: "au" | "nz";
  slug: string;
  timezone?: string;
}

function toContext(row: TenantRow): TenantContext {
  return {
    d1Binding: row.d1Binding,
    d1DatabaseId: row.d1DatabaseId,
    hostname: row.hostname,
    id: row.id,
    name: row.name,
    orgId: row.orgId,
    r2Prefix: row.r2Prefix,
    region: row.region,
    slug: row.slug,
    status: row.status,
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
  if (!slug) {
    return err("invalid_slug", 400, "Slug is required");
  }

  const db = getRegistryDb();
  const existing = await findBySlug(db, slug);
  if (existing) {
    return err("slug_taken", 409, `City ${slug} already exists`);
  }

  const now = new Date(nowMs());
  const orgId = generateOrgId();
  const d1Binding = toD1Binding(slug);
  const row = await insertTenant(db, {
    createdAt: now,
    d1Binding,
    d1DatabaseId: input.d1DatabaseId ?? `pending-${slug}`,
    hostname: input.hostname ?? null,
    id: newId("ten"),
    listed: input.listed ?? true,
    name: input.name.trim() || slug,
    orgId,
    r2Prefix: `tenants/${slug}`,
    region: input.region ?? "au",
    slug,
    status: "active",
    timezone: input.timezone ?? "Australia/Sydney",
    updatedAt: now,
  });

  await db.insert(tenantSettings).values({
    configJson: "{}",
    createdAt: now,
    id: newId("tset"),
    orgId,
    updatedAt: now,
  });

  return ok({ tenant: toContext(row) });
}

export async function listPublicTenants(): Promise<
  Result<{ tenants: { slug: string; name: string }[] }>
> {
  try {
    const db = getRegistryDb();
    const rows = await listListed(db);
    return ok({
      tenants: rows.map((r) => ({ name: r.name, slug: r.slug })),
    });
  } catch {
    // Local/dev without D1 migrated yet
    return ok({ tenants: [] });
  }
}

export async function resolveCityContext(slug: string): Promise<Result<{ tenant: TenantContext }>> {
  try {
    const db = getRegistryDb();
    const row = await findBySlug(db, toSafeSlug(slug));
    if (!row) {
      return err("not_found", 404);
    }
    if (row.status === "suspended") {
      return err("suspended", 503);
    }
    if (row.status === "archived") {
      return err("not_found", 404);
    }
    return ok({ tenant: toContext(row) });
  } catch (e) {
    return err("registry_unavailable", 503, e instanceof Error ? e.message : undefined);
  }
}
