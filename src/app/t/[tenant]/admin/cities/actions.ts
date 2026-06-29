"use server";

import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  type AdminCity,
  type CityInput,
  createCity,
  deleteCity,
  reorderCities,
  updateCity,
} from "@/lib/services/cities";

export type SaveCityResult = { ok: true; city: AdminCity } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Per-tenant city catalog writes. SERVER ACTIONS (not flat `/api` routes) so they
 * always run in the URL tenant's scope — under path-prefix tenancy
 * (`/<slug>/admin/cities`) the action POSTs to the tenant subtree and the scoped
 * Prisma client (inside the service) resolves the right community, where a flat
 * `/api/*` call would mis-scope. Each re-gates `cities.edit` for THIS tenant; the
 * service re-validates the payload and re-checks the permission as defense-in-depth.
 */

/** Create (slug === null) or update (slug = the ORIGINAL slug to look up) a city. */
export async function saveCity(slug: string | null, input: CityInput): Promise<SaveCityResult> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor) return { ok: false, error: "Not signed in" };
  if (actor.isBanned || !hasPermission(actor, "cities.edit")) {
    return { ok: false, error: "You don't have permission to edit cities." };
  }

  try {
    const city =
      slug === null ? await createCity(actor, input) : await updateCity(actor, slug, input);
    return { ok: true, city };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function removeCity(slug: string): Promise<ActionResult> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor) return { ok: false, error: "Not signed in" };
  if (actor.isBanned || !hasPermission(actor, "cities.edit")) {
    return { ok: false, error: "You don't have permission to edit cities." };
  }

  try {
    await deleteCity(actor, slug);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function saveOrder(orderedSlugs: string[]): Promise<ActionResult> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor) return { ok: false, error: "Not signed in" };
  if (actor.isBanned || !hasPermission(actor, "cities.edit")) {
    return { ok: false, error: "You don't have permission to edit cities." };
  }

  try {
    await reorderCities(actor, orderedSlugs);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
