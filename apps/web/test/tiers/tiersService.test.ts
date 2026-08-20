import { describe, expect, it } from "vitest";
import {
  createTier,
  listPublicTiers,
  listTiers,
  removeTier,
  updateTier,
} from "@/modules/tiers/services/tiersService";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("tiersService", () => {
  it("requires tiers.view to list and tiers.edit to create", async () => {
    const store = openMemoryTenant();
    const deniedList = await listTiers(store, memberActor());
    expect(deniedList.ok).toBe(false);
    if (!deniedList.ok) {
      expect(deniedList.error.status).toBe(403);
    }

    const denied = await createTier(store, memberActor(), { name: "Gold", price: 10 });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const created = await createTier(store, adminActor(), {
      description: "Paid members",
      name: "Gold",
      price: 10,
      yearlyPrice: 100,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.tier.name).toBe("Gold");
    expect(created.tier.slug).toBe("gold");
    expect(created.tier.price).toBe(10);
    expect(created.tier.yearlyPrice).toBe(100);
    expect(created.tier.id.startsWith("tier_")).toBe(true);

    const listed = await listTiers(store, adminActor());
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.tiers.map((tier) => tier.name)).toEqual(["Gold"]);
    }

    const publicList = await listPublicTiers(store);
    expect(publicList.ok && publicList.tiers.map((tier) => tier.name)).toEqual(["Gold"]);
    await updateTier(store, adminActor(), created.tier.id, {
      isActive: false,
      name: "Gold",
      price: 10,
    });
    const hidden = await listPublicTiers(store);
    expect(hidden.ok && hidden.tiers).toEqual([]);
  });

  it("rejects duplicate name/slug and updates then deletes", async () => {
    const store = openMemoryTenant();
    const created = await createTier(store, adminActor(), { name: "Gold", price: 10 });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const dupName = await createTier(store, adminActor(), { name: "Gold", price: 12 });
    expect(dupName.ok).toBe(false);
    if (!dupName.ok) {
      expect(dupName.error.status).toBe(409);
    }

    const dupSlug = await createTier(store, adminActor(), { name: "Gold Plan", slug: "gold" });
    expect(dupSlug.ok).toBe(false);
    if (!dupSlug.ok) {
      expect(dupSlug.error.status).toBe(409);
    }

    const deniedUpdate = await updateTier(store, memberActor(), created.tier.id, { name: "Pro" });
    expect(deniedUpdate.ok).toBe(false);
    if (!deniedUpdate.ok) {
      expect(deniedUpdate.error.status).toBe(403);
    }

    const renamed = await updateTier(store, adminActor(), created.tier.id, {
      name: "Pro",
      price: 20,
    });
    expect(renamed.ok).toBe(true);

    const listed = await listTiers(store, adminActor());
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.tiers.map((tier) => [tier.name, tier.slug, tier.price])).toEqual([
        ["Pro", "pro", 20],
      ]);
    }

    const deniedDelete = await removeTier(store, memberActor(), created.tier.id);
    expect(deniedDelete.ok).toBe(false);
    if (!deniedDelete.ok) {
      expect(deniedDelete.error.status).toBe(403);
    }

    const removed = await removeTier(store, adminActor(), created.tier.id);
    expect(removed.ok).toBe(true);
    const gone = await listTiers(store, adminActor());
    expect(gone.ok).toBe(true);
    if (gone.ok) {
      expect(gone.tiers).toEqual([]);
    }
  });

  it("rejects invalid write input via the module zod schema", async () => {
    const store = openMemoryTenant();

    const blankName = await createTier(store, adminActor(), { name: "   ", price: 10 });
    expect(blankName.ok).toBe(false);
    if (!blankName.ok) {
      expect(blankName.error.status).toBe(400);
    }

    const negativePrice = await createTier(store, adminActor(), { name: "Gold", price: -5 });
    expect(negativePrice.ok).toBe(false);
    if (!negativePrice.ok) {
      expect(negativePrice.error.status).toBe(400);
    }

    const negativeYearly = await createTier(store, adminActor(), {
      name: "Gold",
      price: 10,
      yearlyPrice: -1,
    });
    expect(negativeYearly.ok).toBe(false);
    if (!negativeYearly.ok) {
      expect(negativeYearly.error.status).toBe(400);
    }

    const negativeOrder = await createTier(store, adminActor(), {
      name: "Gold",
      order: -1,
      price: 10,
    });
    expect(negativeOrder.ok).toBe(false);
    if (!negativeOrder.ok) {
      expect(negativeOrder.error.status).toBe(400);
    }
  });
});
