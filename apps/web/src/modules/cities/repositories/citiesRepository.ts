import { and, asc, eq, sql } from "drizzle-orm";
import type { AdminCity, CityWrite } from "@/modules/cities/types";
import { first } from "@/shared/db/rows";
import type { TenantTables } from "@/shared/db/tenantSchema";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

/** The only tables this repository may touch. */
type CitiesTables = Pick<TenantTables, "cities">;
const tables = (store: TenantStore): CitiesTables => store.tables;

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

function parseKeywords(raw: string): string[] {
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

function toAdmin(row: {
  description: string;
  id: string;
  isCapital: boolean;
  keywordsJson: string;
  name: string;
  position: number;
  slug: string;
  state: string;
  stateFull: string;
  timezone: string;
}): AdminCity {
  return {
    description: row.description,
    id: row.id,
    isCapital: Boolean(row.isCapital),
    keywords: parseKeywords(row.keywordsJson),
    name: row.name,
    position: row.position,
    slug: row.slug,
    state: row.state,
    stateFull: row.stateFull,
    timezone: row.timezone,
  };
}

export async function listCities(store: TenantStore): Promise<AdminCity[]> {
  const { cities } = tables(store);
  const rows = await store.db
    .select()
    .from(cities)
    .where(eq(cities.orgId, store.orgId))
    .orderBy(asc(cities.position), asc(cities.name));
  return rows.map(toAdmin);
}

export async function findBySlug(store: TenantStore, slug: string): Promise<AdminCity | null> {
  const { cities } = tables(store);
  const row = first(
    await store.db
      .select()
      .from(cities)
      .where(and(eq(cities.orgId, store.orgId), eq(cities.slug, slug)))
      .limit(1),
  );
  return row ? toAdmin(row) : null;
}

export async function nextPosition(store: TenantStore): Promise<number> {
  const { cities } = tables(store);
  const row = first(
    await store.db
      .select({ position: sql<number>`max(${cities.position})` })
      .from(cities)
      .where(eq(cities.orgId, store.orgId)),
  );
  if (row?.position === undefined || row?.position === null) {
    return 0;
  }
  return Number(row.position) + 1;
}

export async function insertCity(
  store: TenantStore,
  write: CityWrite,
  position: number,
): Promise<Result<{ city: AdminCity }>> {
  const { cities } = tables(store);
  const now = new Date();
  const id = newId("cty");
  try {
    await store.db.insert(cities).values({
      createdAt: now,
      description: write.description,
      id,
      isCapital: write.isCapital,
      keywordsJson: JSON.stringify(write.keywords),
      name: write.name,
      orgId: store.orgId,
      position,
      slug: write.slug,
      state: write.state,
      stateFull: write.stateFull,
      timezone: write.timezone,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A city with this slug already exists");
    }
    throw error;
  }
  return ok({
    city: {
      description: write.description,
      id,
      isCapital: write.isCapital,
      keywords: write.keywords,
      name: write.name,
      position,
      slug: write.slug,
      state: write.state,
      stateFull: write.stateFull,
      timezone: write.timezone,
    },
  });
}

export async function updateCityBySlug(
  store: TenantStore,
  currentSlug: string,
  write: CityWrite,
): Promise<Result<{ city: AdminCity }>> {
  const { cities } = tables(store);
  try {
    await store.db
      .update(cities)
      .set({
        description: write.description,
        isCapital: write.isCapital,
        keywordsJson: JSON.stringify(write.keywords),
        name: write.name,
        slug: write.slug,
        state: write.state,
        stateFull: write.stateFull,
        timezone: write.timezone,
        updatedAt: new Date(),
      })
      .where(and(eq(cities.orgId, store.orgId), eq(cities.slug, currentSlug)));
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A city with this slug already exists");
    }
    throw error;
  }
  const updated = await findBySlug(store, write.slug);
  if (!updated) {
    return err("not_found", 404, "City not found");
  }
  return ok({ city: updated });
}

export async function deleteCityBySlug(
  store: TenantStore,
  slug: string,
): Promise<Result<{ success: true }>> {
  const { cities } = tables(store);
  await store.db.delete(cities).where(and(eq(cities.orgId, store.orgId), eq(cities.slug, slug)));
  return ok({ success: true });
}

export async function setPosition(
  store: TenantStore,
  slug: string,
  position: number,
): Promise<void> {
  const { cities } = tables(store);
  await store.db
    .update(cities)
    .set({ position, updatedAt: new Date() })
    .where(and(eq(cities.orgId, store.orgId), eq(cities.slug, slug)));
}
