// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as citiesRepo from "@/modules/cities/repositories/citiesRepository";
import type { AdminCity, CityInput, CityWrite } from "@/modules/cities/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateInput(input: CityInput): Result<{ write: CityWrite }> {
  const slug = input.slug.trim().toLowerCase();
  if (!slug) {
    return err("bad_request", 400, "Slug is required");
  }
  if (!SLUG_RE.test(slug)) {
    return err(
      "bad_request",
      400,
      "Slug must be lowercase, url-safe (letters, numbers, single hyphens)",
    );
  }
  const name = input.name.trim();
  const state = input.state.trim();
  const stateFull = input.stateFull.trim();
  const description = input.description.trim();
  const timezone = input.timezone.trim();
  if (!name) {
    return err("bad_request", 400, "Name is required");
  }
  if (!state) {
    return err("bad_request", 400, "State is required");
  }
  if (!stateFull) {
    return err("bad_request", 400, "Full state name is required");
  }
  if (!description) {
    return err("bad_request", 400, "Description is required");
  }
  if (!timezone) {
    return err("bad_request", 400, "Timezone is required");
  }
  if (!Array.isArray(input.keywords)) {
    return err("bad_request", 400, "Keywords must be an array");
  }
  if (typeof input.isCapital !== "boolean") {
    return err("bad_request", 400, "isCapital must be a boolean");
  }
  return ok({
    write: {
      description,
      isCapital: input.isCapital,
      keywords: input.keywords
        .map((keyword) => (typeof keyword === "string" ? keyword.trim() : ""))
        .filter(Boolean),
      name,
      slug,
      state,
      stateFull,
      timezone,
    },
  });
}

export async function listCitiesPublic(
  store: TenantStore,
): Promise<Result<{ cities: AdminCity[] }>> {
  return ok({ cities: await citiesRepo.listCities(store) });
}

export async function getCityPublic(
  store: TenantStore,
  slug: string,
): Promise<Result<{ city: AdminCity }>> {
  const city = await citiesRepo.findBySlug(store, slug);
  if (!city) {
    return err("not_found", 404, "City not found");
  }
  return ok({ city });
}

export async function listCitiesAdmin(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ cities: AdminCity[] }>> {
  const perm = ensurePermission(actor, "cities.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ cities: await citiesRepo.listCities(store) });
}

export async function createCity(
  store: TenantStore,
  actor: Actor,
  input: CityInput,
): Promise<Result<{ city: AdminCity }>> {
  const perm = ensurePermission(actor, "cities.edit");
  if (!perm.ok) {
    return perm;
  }
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }
  return await citiesRepo.insertCity(store, validated.write, await citiesRepo.nextPosition(store));
}

export async function updateCity(
  store: TenantStore,
  actor: Actor,
  slug: string,
  input: CityInput,
): Promise<Result<{ city: AdminCity }>> {
  const perm = ensurePermission(actor, "cities.edit");
  if (!perm.ok) {
    return perm;
  }
  const current = slug.trim().toLowerCase();
  if (!current) {
    return err("bad_request", 400, "Slug is required");
  }
  if (!(await citiesRepo.findBySlug(store, current))) {
    return err("not_found", 404, "City not found");
  }
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }
  return await citiesRepo.updateCityBySlug(store, current, validated.write);
}

export async function removeCity(
  store: TenantStore,
  actor: Actor,
  slug: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "cities.edit");
  if (!perm.ok) {
    return perm;
  }
  const current = slug.trim().toLowerCase();
  if (!current) {
    return err("bad_request", 400, "Slug is required");
  }
  if (!(await citiesRepo.findBySlug(store, current))) {
    return err("not_found", 404, "City not found");
  }
  return await citiesRepo.deleteCityBySlug(store, current);
}

export async function reorderCities(
  store: TenantStore,
  actor: Actor,
  orderedSlugs: string[],
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "cities.edit");
  if (!perm.ok) {
    return perm;
  }
  for (const [index, slug] of orderedSlugs.entries()) {
    // D1 has no interactive transaction — apply order one row at a time.
    // biome-ignore lint/performance/noAwaitInLoops: sequential D1 writes
    await citiesRepo.setPosition(store, slug.trim().toLowerCase(), index);
  }
  return ok({ success: true });
}
