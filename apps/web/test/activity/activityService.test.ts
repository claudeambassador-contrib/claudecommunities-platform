import { describe, expect, it } from "vitest";

import { listActivity, recordActivity } from "@/modules/activity/services/activityService";

import { openMemoryTenant } from "../helpers/tenant";

describe("activityService", () => {
  it("records activity and lists newest first, optionally filtered by user", async () => {
    const store = openMemoryTenant();
    const first = await recordActivity(store, {
      data: { postId: "pst_1" },
      type: "post_created",
      userId: "usr_ada",
    });
    expect(first.ok && first.recorded).toBeTruthy();
    await recordActivity(store, { type: "comment_created", userId: "usr_al" });

    const all = await listActivity(store);
    expect(all.ok).toBeTruthy();
    if (!all.ok) {
      return;
    }
    expect(all.activities.map((row) => row.userId)).toStrictEqual(["usr_al", "usr_ada"]);
    expect(all.activities[1]?.data).toStrictEqual({ postId: "pst_1" });

    const ada = await listActivity(store, { userId: "usr_ada" });
    expect(ada.ok).toBeTruthy();
    if (ada.ok) {
      expect(ada.activities).toHaveLength(1);
      expect(ada.activities[0]?.type).toBe("post_created");
    }

    const skipped = await recordActivity(store, { type: "post_created", userId: "" });
    expect(skipped.ok && skipped.recorded).toBeFalsy();
  });
});
