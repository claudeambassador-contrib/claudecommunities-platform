import { describe, expect, it } from "vitest";

import {
  createNotification,
  listNotifications,
  markAllRead,
} from "@/modules/notifications/services/notificationsService";

import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("notificationsService", () => {
  it("lists only the actor's notifications and counts unread", async () => {
    const store = openMemoryTenant();
    await createNotification(store, {
      message: "Ada liked your post",
      title: "New like",
      type: "like",
      userId: memberActor().id,
    });
    await createNotification(store, {
      message: "Admin only",
      title: "Hidden",
      type: "badge",
      userId: adminActor().id,
    });

    const listed = await listNotifications(store, memberActor());
    expect(listed.ok).toBeTruthy();
    if (!listed.ok) {
      return;
    }
    expect(listed.unreadCount).toBe(1);
    expect(listed.notifications).toHaveLength(1);
    expect(listed.notifications[0]?.payload.title).toBe("New like");
  });

  it("marks the actor inbox read and rejects a bad type", async () => {
    const store = openMemoryTenant();
    const actor = memberActor();
    await createNotification(store, {
      message: "Hello",
      title: "Reply",
      type: "reply",
      userId: actor.id,
    });
    const marked = await markAllRead(store, actor);
    expect(marked.ok).toBeTruthy();
    const listed = await listNotifications(store, actor, { unreadOnly: true });
    expect(listed.ok).toBeTruthy();
    if (listed.ok) {
      expect(listed.unreadCount).toBe(0);
      expect(listed.notifications).toStrictEqual([]);
    }

    const bad = await createNotification(store, {
      message: "x",
      title: "y",
      type: "nope",
      userId: actor.id,
    });
    expect(bad.ok).toBeFalsy();
    if (!bad.ok) {
      expect(bad.error.status).toBe(400);
    }
  });
});
