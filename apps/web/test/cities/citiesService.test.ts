import { describe, expect, it } from "vitest";
import {
  createCity,
  listCitiesAdmin,
  removeCity,
  reorderCities,
  updateCity,
} from "@/modules/cities/services/citiesService";
import type { CityInput } from "@/modules/cities/types";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

function city(overrides: Partial<CityInput> = {}): CityInput {
  return {
    description: "Sydney meetup",
    isCapital: true,
    keywords: ["Sydney"],
    name: "Sydney",
    slug: "sydney",
    state: "NSW",
    stateFull: "New South Wales",
    timezone: "Australia/Sydney",
    ...overrides,
  };
}

describe("citiesService", () => {
  it("lists for cities.view and creates unique slugs for cities.edit", async () => {
    const store = openMemoryTenant();
    const denied = await listCitiesAdmin(store, memberActor());
    expect(denied.ok).toBe(false);

    const created = await createCity(store, adminActor(), city());
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.city.position).toBe(0);

    const dup = await createCity(store, adminActor(), city());
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error.status).toBe(409);
    }

    const melbourne = await createCity(
      store,
      adminActor(),
      city({
        description: "Melbourne meetup",
        isCapital: true,
        keywords: ["Melbourne"],
        name: "Melbourne",
        slug: "melbourne",
        state: "VIC",
        stateFull: "Victoria",
        timezone: "Australia/Melbourne",
      }),
    );
    expect(melbourne.ok).toBe(true);
    if (melbourne.ok) {
      expect(melbourne.city.position).toBe(1);
    }

    const listed = await listCitiesAdmin(store, adminActor());
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.cities.map((row) => row.slug)).toEqual(["sydney", "melbourne"]);
    }
  });

  it("updates, reorders, and deletes by slug", async () => {
    const store = openMemoryTenant();
    await createCity(store, adminActor(), city());
    await createCity(
      store,
      adminActor(),
      city({
        description: "Melbourne meetup",
        isCapital: true,
        keywords: ["Melbourne"],
        name: "Melbourne",
        slug: "melbourne",
        state: "VIC",
        stateFull: "Victoria",
        timezone: "Australia/Melbourne",
      }),
    );

    const renamed = await updateCity(store, adminActor(), "sydney", city({ name: "Sydney CBD" }));
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      expect(renamed.city.name).toBe("Sydney CBD");
    }

    const reordered = await reorderCities(store, adminActor(), ["melbourne", "sydney"]);
    expect(reordered.ok).toBe(true);
    const listed = await listCitiesAdmin(store, adminActor());
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.cities.map((row) => row.slug)).toEqual(["melbourne", "sydney"]);
    }

    const removed = await removeCity(store, adminActor(), "melbourne");
    expect(removed.ok).toBe(true);
    const missing = await removeCity(store, adminActor(), "melbourne");
    expect(missing.ok).toBe(false);
  });
});
