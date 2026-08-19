import { and, asc, eq } from "drizzle-orm";
import type { TierSummary, TierWrite } from "@/modules/tiers/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function parseFeatures(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function toSummary(row: {
  color: string | null;
  createdAt: Date;
  description: string | null;
  featuresJson: string;
  id: string;
  isActive: boolean;
  name: string;
  order: number;
  price: number;
  slug: string;
  updatedAt: Date;
  yearlyPrice: number | null;
}): TierSummary {
  return {
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    features: parseFeatures(row.featuresJson),
    id: row.id,
    isActive: Boolean(row.isActive),
    name: row.name,
    order: row.order,
    price: Number(row.price),
    slug: row.slug,
    updatedAt: row.updatedAt.toISOString(),
    yearlyPrice: row.yearlyPrice === null ? null : Number(row.yearlyPrice),
  };
}

export async function listTiers(store: TenantStore): Promise<TierSummary[]> {
  const { membershipTiers } = store.tables;
  const rows = await store.db
    .select()
    .from(membershipTiers)
    .where(eq(membershipTiers.orgId, store.orgId))
    .orderBy(asc(membershipTiers.order), asc(membershipTiers.name));
  return rows.map(toSummary);
}

export async function findTier(store: TenantStore, id: string): Promise<TierSummary | null> {
  const { membershipTiers } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(membershipTiers)
      .where(and(eq(membershipTiers.orgId, store.orgId), eq(membershipTiers.id, id)))
      .limit(1),
  );
  return row ? toSummary(row) : null;
}

export async function insertTier(
  store: TenantStore,
  write: TierWrite,
): Promise<Result<{ tier: TierSummary }>> {
  const { membershipTiers } = store.tables;
  const now = new Date();
  const id = newId("tier");
  try {
    await store.db.insert(membershipTiers).values({
      color: write.color,
      createdAt: now,
      description: write.description,
      featuresJson: JSON.stringify(write.features),
      id,
      isActive: write.isActive,
      name: write.name,
      order: write.order,
      orgId: store.orgId,
      price: write.price,
      slug: write.slug,
      updatedAt: now,
      yearlyPrice: write.yearlyPrice,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A tier with this name or slug already exists");
    }
    throw error;
  }
  return ok({
    tier: {
      color: write.color,
      createdAt: now.toISOString(),
      description: write.description,
      features: write.features,
      id,
      isActive: write.isActive,
      name: write.name,
      order: write.order,
      price: write.price,
      slug: write.slug,
      updatedAt: now.toISOString(),
      yearlyPrice: write.yearlyPrice,
    },
  });
}

export async function updateTier(
  store: TenantStore,
  id: string,
  write: TierWrite,
): Promise<Result<{ success: true }>> {
  const existing = await findTier(store, id);
  if (!existing) {
    return err("not_found", 404, "Tier not found");
  }
  const { membershipTiers } = store.tables;
  try {
    await store.db
      .update(membershipTiers)
      .set({
        color: write.color,
        description: write.description,
        featuresJson: JSON.stringify(write.features),
        isActive: write.isActive,
        name: write.name,
        order: write.order,
        price: write.price,
        slug: write.slug,
        updatedAt: new Date(),
        yearlyPrice: write.yearlyPrice,
      })
      .where(and(eq(membershipTiers.orgId, store.orgId), eq(membershipTiers.id, id)));
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A tier with this name or slug already exists");
    }
    throw error;
  }
  return ok({ success: true });
}

export async function deleteTier(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await findTier(store, id);
  if (!existing) {
    return err("not_found", 404, "Tier not found");
  }
  const { membershipTiers } = store.tables;
  await store.db
    .delete(membershipTiers)
    .where(and(eq(membershipTiers.orgId, store.orgId), eq(membershipTiers.id, id)));
  return ok({ success: true });
}
