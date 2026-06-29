/**
 * Cities service — admin-only writes, public reads (via `@/lib/cities-data`).
 *
 * Rows are tenant-scoped: the scoped client (`getPrisma()`) injects/filters
 * `tenantId` on every operation, so slug is unique-per-tenant and the
 * `updateMany`/`deleteMany`-by-slug pattern (à la roles.ts) is safe — the
 * chokepoint adds the `tenantId` filter.
 */
import type { City } from "@/lib/cities";
import { getPrisma } from "@/lib/prisma";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

/** A city row as the admin UI consumes it — the runtime `City` plus row metadata. */
export type AdminCity = City & { id: string; position: number };

export interface CityInput {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  description: string;
  timezone: string;
  keywords: string[];
  isCapital: boolean;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    // fall through
  }
  return [];
}

function toAdminCity(row: {
  id: string;
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  description: string;
  isCapital: boolean;
  keywords: string;
  timezone: string;
  position: number;
}): AdminCity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: row.state,
    stateFull: row.stateFull,
    description: row.description,
    isCapital: row.isCapital,
    keywords: parseKeywords(row.keywords),
    timezone: row.timezone,
    position: row.position,
  };
}

/** Validate + normalise a CityInput. Throws ServiceError("bad_request") on bad data. */
function validateInput(input: CityInput): {
  slug: string;
  name: string;
  state: string;
  stateFull: string;
  description: string;
  timezone: string;
  keywords: string;
  isCapital: boolean;
} {
  const slug = input.slug?.trim().toLowerCase();
  if (!slug) throw new ServiceError("bad_request", "Slug is required");
  if (!SLUG_RE.test(slug)) {
    throw new ServiceError(
      "bad_request",
      "Slug must be lowercase, url-safe (letters, numbers, single hyphens)",
    );
  }

  const name = input.name?.trim();
  if (!name) throw new ServiceError("bad_request", "Name is required");
  const state = input.state?.trim();
  if (!state) throw new ServiceError("bad_request", "State is required");
  const stateFull = input.stateFull?.trim();
  if (!stateFull) throw new ServiceError("bad_request", "Full state name is required");
  const description = input.description?.trim();
  if (!description) throw new ServiceError("bad_request", "Description is required");
  const timezone = input.timezone?.trim();
  if (!timezone) throw new ServiceError("bad_request", "Timezone is required");

  if (!Array.isArray(input.keywords)) {
    throw new ServiceError("bad_request", "Keywords must be an array");
  }
  const keywords = input.keywords
    .map((k) => (typeof k === "string" ? k.trim() : ""))
    .filter((k) => k.length > 0);

  if (typeof input.isCapital !== "boolean") {
    throw new ServiceError("bad_request", "isCapital must be a boolean");
  }

  return {
    slug,
    name,
    state,
    stateFull,
    description,
    timezone,
    keywords: JSON.stringify(keywords),
    isCapital: input.isCapital,
  };
}

/** List the current tenant's cities for the admin UI (incl. id + position). */
export async function listCitiesAdmin(actor: ActorLike): Promise<AdminCity[]> {
  const db = await getPrisma();
  ensurePermission(actor, "cities.view");
  const rows = await db.city.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  return rows.map(toAdminCity);
}

export async function createCity(actor: ActorLike, input: CityInput): Promise<AdminCity> {
  const db = await getPrisma();
  ensurePermission(actor, "cities.edit");
  const data = validateInput(input);

  const existing = await db.city.findFirst({ where: { slug: data.slug }, select: { id: true } });
  if (existing) throw new ServiceError("conflict", "A city with this slug already exists");

  // Append to the end of the current ordering.
  const last = await db.city.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const row = await db.city.create({ data: { ...data, position } });
  return toAdminCity(row);
}

export async function updateCity(
  actor: ActorLike,
  slug: string,
  input: CityInput,
): Promise<AdminCity> {
  const db = await getPrisma();
  ensurePermission(actor, "cities.edit");
  const current = slug?.trim().toLowerCase();
  if (!current) throw new ServiceError("bad_request", "Slug is required");

  const existing = await db.city.findFirst({ where: { slug: current } });
  if (!existing) throw new ServiceError("not_found", "City not found");

  const data = validateInput(input);

  // If the slug changed, ensure the new one is free.
  if (data.slug !== current) {
    const dup = await db.city.findFirst({ where: { slug: data.slug }, select: { id: true } });
    if (dup) throw new ServiceError("conflict", "A city with this slug already exists");
  }

  // Slug isn't the @id (cuid id is); scoped updateMany injects tenantId.
  await db.city.updateMany({ where: { slug: current }, data });
  const row = await db.city.findFirst({ where: { slug: data.slug } });
  if (!row) throw new ServiceError("not_found", "City not found");
  return toAdminCity(row);
}

export async function deleteCity(actor: ActorLike, slug: string): Promise<void> {
  const db = await getPrisma();
  ensurePermission(actor, "cities.edit");
  const current = slug?.trim().toLowerCase();
  if (!current) throw new ServiceError("bad_request", "Slug is required");

  const existing = await db.city.findFirst({ where: { slug: current }, select: { id: true } });
  if (!existing) throw new ServiceError("not_found", "City not found");

  // Scoped deleteMany injects tenantId (slug isn't the @id).
  await db.city.deleteMany({ where: { slug: current } });
}

/** Set each city's `position` to its index in `orderedSlugs`. */
export async function reorderCities(actor: ActorLike, orderedSlugs: string[]): Promise<void> {
  const db = await getPrisma();
  ensurePermission(actor, "cities.edit");
  if (!Array.isArray(orderedSlugs)) {
    throw new ServiceError("bad_request", "orderedSlugs must be an array");
  }

  await Promise.all(
    orderedSlugs.map((slug, index) =>
      db.city.updateMany({ where: { slug: slug.toLowerCase() }, data: { position: index } }),
    ),
  );
}
