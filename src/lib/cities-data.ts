/**
 * Server-side city loader — the runtime successor to the build-baked `CITIES`
 * in `src/lib/cities.ts`. Reads the current tenant's `City` rows and maps them
 * to the runtime `City` shape. Request-memoized via React `cache()`, mirroring
 * `getTenantConfig()` (`src/lib/tenant-config.ts`).
 *
 * Tenant-scoped: reads via the SCOPED client (`getPrisma()`), so it only ever
 * sees the current tenant's cities. Returns `[]` when the tenant has none.
 */
import { cache } from "react";
import type { City } from "@/lib/cities";
import { getPrisma } from "@/lib/prisma";

/** Parse the stored `keywords` JSON string into a string[], safely. */
function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    // fall through
  }
  return [];
}

/**
 * The current tenant's cities, ordered by admin `position` then `name`.
 * Request-memoized. Returns `[]` if the tenant has no cities.
 */
export const getCities = cache(async (): Promise<City[]> => {
  const db = await getPrisma();
  const rows = await db.city.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    state: row.state,
    stateFull: row.stateFull,
    description: row.description,
    isCapital: row.isCapital,
    keywords: parseKeywords(row.keywords),
    timezone: row.timezone,
  }));
});
