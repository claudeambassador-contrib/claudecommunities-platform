import { describe, expect, it } from "vitest";
import {
  awardBadge,
  createBadge,
  getBadge,
  listBadges,
  removeBadge,
  revokeBadge,
  updateBadge,
} from "@/modules/badges/services/badgesService";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("badgesService", () => {
  it("lets anyone list badges and requires badges.edit to create", async () => {
    const store = openMemoryTenant();
    const denied = await createBadge(store, memberActor(), { name: "Pioneer" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const created = await createBadge(store, adminActor(), {
      description: "First wave",
      name: "Pioneer",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.badge.name).toBe("Pioneer");
    expect(created.badge.userCount).toBe(0);

    const listed = await listBadges(store);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.badges.map((badge) => badge.name)).toEqual(["Pioneer"]);
    }
  });

  it("rejects duplicate names and awards then revokes a holder", async () => {
    const store = openMemoryTenant();
    const created = await createBadge(store, adminActor(), { name: "Pioneer" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const dup = await createBadge(store, adminActor(), { name: "Pioneer" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error.status).toBe(409);
    }

    const awarded = await awardBadge(store, adminActor(), created.badge.id, "usr_ada");
    expect(awarded.ok).toBe(true);
    const again = await awardBadge(store, adminActor(), created.badge.id, "usr_ada");
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.status).toBe(409);
    }

    const detail = await getBadge(store, created.badge.id);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.badge.userCount).toBe(1);
      expect(detail.badge.users.map((user) => user.userId)).toEqual(["usr_ada"]);
    }

    const revoked = await revokeBadge(store, adminActor(), created.badge.id, "usr_ada");
    expect(revoked.ok).toBe(true);
    const missing = await revokeBadge(store, adminActor(), created.badge.id, "usr_ada");
    expect(missing.ok).toBe(false);

    const renamed = await updateBadge(store, adminActor(), created.badge.id, { name: "Founder" });
    expect(renamed.ok).toBe(true);
    const removed = await removeBadge(store, adminActor(), created.badge.id);
    expect(removed.ok).toBe(true);
    const gone = await getBadge(store, created.badge.id);
    expect(gone.ok).toBe(false);
  });
});
