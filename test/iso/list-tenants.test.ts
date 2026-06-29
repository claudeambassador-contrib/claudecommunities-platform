import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listTenants } from "@/lib/services/tenants";
import { freshDb, seedTenant, seedUser } from "./helpers";

// `listTenants` powers the admin Tenants configurator page's server render. It
// runs a Prisma `groupBy` for membership counts — a query shape NOTHING else in
// the suite exercises. Run it against the SQLite adapter (a close proxy for D1's
// SQL generation): if groupBy executes here, the page won't 500 on render.
// (Generous timeout: cold Prisma-WASM init + several creates is slow.)
describe("listTenants", () => {
  let base: PrismaClient;
  let cleanup: () => void;
  beforeEach(() => ({ base, cleanup } = freshDb()));
  afterEach(() => cleanup());

  it("returns tenants with membership counts (groupBy executes on the adapter)", async () => {
    const u1 = await seedUser(base, "u1", "u1@test.dev");
    const u2 = await seedUser(base, "u2", "u2@test.dev");
    await seedTenant(base, "alpha", u1.id); // owner membership = 1
    await base.userTenant.create({ data: { tenantId: "alpha", userId: u2.id, role: "member" } });
    await base.tenant.create({ data: { slug: "empty", name: "Empty", status: "active" } });

    const tenants = await listTenants(base);

    expect(tenants.find((t) => t.slug === "alpha")?.memberCount).toBe(2);
    expect(tenants.find((t) => t.slug === "empty")?.memberCount).toBe(0);
  }, 30_000);
});
