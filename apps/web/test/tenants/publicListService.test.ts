import { describe, expect, it } from "vitest";
import {
  listPublicTenants,
  provisionCity,
  resolveCityContext,
} from "@/modules/tenants/services/publicListService";
import { openMemoryRegistry } from "../helpers/registry";

describe("publicListService with an in-memory registry", () => {
  it("provisions a city then resolves it by slug", async () => {
    const { db } = openMemoryRegistry();

    const provisioned = await provisionCity(db, { name: "Sydney", slug: "sydney" });
    expect(provisioned.ok).toBe(true);

    const resolved = await resolveCityContext(db, "sydney");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.tenant.slug).toBe("sydney");
      expect(resolved.tenant.r2Prefix).toBe("tenants/sydney");
    }
  });

  it("404s an unknown slug", async () => {
    const { db } = openMemoryRegistry();
    const resolved = await resolveCityContext(db, "nowhere");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("not_found");
    }
  });

  it("lists only listed tenants", async () => {
    const { db } = openMemoryRegistry();
    await provisionCity(db, { listed: true, name: "Sydney", slug: "sydney" });
    await provisionCity(db, { listed: false, name: "Hidden", slug: "hidden" });
    const result = await listPublicTenants(db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenants.map((t) => t.slug)).toEqual(["sydney"]);
    }
  });
});
