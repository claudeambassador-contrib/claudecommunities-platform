import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { events } from "@/modules/events/schema.tenant";
import { createTenantSchema } from "@/shared/db/tenantSchema";
import { tenantStore } from "@/shared/db/tenantStore";

function openTenantDb(orgId: string, binding: string) {
  const sqlite = new Database(":memory:");
  const sql = readFileSync(
    resolve(import.meta.dirname, "../../drizzle/tenant/0001_initial.sql"),
    "utf-8",
  );
  sqlite.exec(sql);
  const db = drizzle(sqlite, { schema: createTenantSchema() });
  return tenantStore(db as never, { binding, orgId });
}

describe("per-city D1 isolation (TenantStore + orgId)", () => {
  let sydney: ReturnType<typeof openTenantDb>;
  let melbourne: ReturnType<typeof openTenantDb>;

  beforeEach(() => {
    sydney = openTenantDb("org_sydney", "TENANT_SYDNEY");
    melbourne = openTenantDb("org_melbourne", "TENANT_MELBOURNE");
  });

  it("does not leak events across city stores even with colliding ids", async () => {
    const now = new Date();
    const sharedId = "evt_shared_id";

    await sydney.db.insert(events).values({
      coverUrl: null,
      createdAt: now,
      description: null,
      endsAt: null,
      id: sharedId,
      location: null,
      orgId: sydney.orgId,
      slug: "meetup",
      startsAt: now,
      status: "published",
      title: "Sydney Meetup",
      updatedAt: now,
    });

    await melbourne.db.insert(events).values({
      coverUrl: null,
      createdAt: now,
      description: null,
      endsAt: null,
      id: sharedId,
      location: null,
      orgId: melbourne.orgId,
      slug: "meetup",
      startsAt: now,
      status: "published",
      title: "Melbourne Meetup",
      updatedAt: now,
    });

    const sydRows = await sydney.db
      .select()
      .from(events)
      .where(and(eq(events.orgId, sydney.orgId), eq(events.id, sharedId)));

    const melRows = await melbourne.db
      .select()
      .from(events)
      .where(and(eq(events.orgId, melbourne.orgId), eq(events.id, sharedId)));

    expect(sydRows).toHaveLength(1);
    expect(sydRows[0]?.title).toBe("Sydney Meetup");
    expect(melRows).toHaveLength(1);
    expect(melRows[0]?.title).toBe("Melbourne Meetup");

    // Wrong orgId filter on a store must return empty (defense-in-depth).
    const leak = await sydney.db
      .select()
      .from(events)
      .where(and(eq(events.orgId, melbourne.orgId), eq(events.id, sharedId)));
    expect(leak).toHaveLength(0);
  });

  it("binds orgId and binding immutably on the store", () => {
    expect(sydney.orgId).toBe("org_sydney");
    expect(sydney.binding).toBe("TENANT_SYDNEY");
    expect(melbourne.orgId).toBe("org_melbourne");
    expect(melbourne.binding).toBe("TENANT_MELBOURNE");
  });
});
