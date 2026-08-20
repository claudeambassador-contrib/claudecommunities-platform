import { describe, expect, it } from "vitest";
import {
  isAllowedImageUrl,
  isAllowedLumaUrl,
  isAllowedMeetingUrl,
  isAllowedResourceUrl,
} from "@/modules/events/schemas";
import {
  addAgendaItem,
  addEventResource,
  createEvent,
  deleteAgendaItem,
  deleteEvent,
  getEvent,
  getLumaInterestStatus,
  getLumaWaitlistCount,
  getRsvpStats,
  listAgenda,
  listEventResources,
  listEventSitemapEntries,
  listEvents,
  listLumaInterestsForUser,
  notifyLumaWaitlist,
  registerLumaInterest,
  reorderAgenda,
  rsvpToEvent,
  setEventActive,
  toPublicEventDetail,
  unregisterLumaInterest,
  updateAgendaItem,
  updateEvent,
} from "@/modules/events/services/eventsService";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

const START = "2026-09-01T09:00:00.000Z";
const FUTURE = "2026-12-01T09:00:00.000Z";

describe("event URL validators", () => {
  it("accepts https Zoom and Luma meeting hosts", () => {
    expect(isAllowedMeetingUrl("https://zoom.us/j/123")).toBe(true);
    expect(isAllowedMeetingUrl("https://us06web.zoom.us/j/123")).toBe(true);
    expect(isAllowedMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isAllowedMeetingUrl("https://lu.ma/meetup")).toBe(true);
  });

  it("rejects non-https and unknown meeting hosts", () => {
    expect(isAllowedMeetingUrl("http://zoom.us/j/123")).toBe(false);
    expect(isAllowedMeetingUrl("https://evil.example/zoom.us")).toBe(false);
    expect(isAllowedMeetingUrl("not-a-url")).toBe(false);
  });

  it("requires https for Luma ticket URLs", () => {
    expect(isAllowedLumaUrl("https://luma.com/event")).toBe(true);
    expect(isAllowedLumaUrl("http://luma.com/event")).toBe(false);
    expect(isAllowedLumaUrl("javascript:alert(1)")).toBe(false);
  });

  it("allows first-party storage and Luma CDN images only", () => {
    expect(isAllowedImageUrl("/api/files/sydney/cover.png")).toBe(true);
    expect(isAllowedImageUrl("https://images.lumacdn.com/photo.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://evil.example/photo.jpg")).toBe(false);
  });

  it("allows https resource links", () => {
    expect(isAllowedResourceUrl("https://drive.google.com/file")).toBe(true);
    expect(isAllowedResourceUrl("/api/files/sydney/deck.pdf")).toBe(true);
    expect(isAllowedResourceUrl("http://example.com/x")).toBe(false);
  });
});

describe("eventsService", () => {
  it("creates an event and makes it retrievable", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      location: "Sydney",
      startTime: START,
      title: "Intro Night",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.event.title).toBe("Intro Night");
    expect(created.event.slug).toBe("intro-night-september-2026");
    expect(created.event.status).toBe("published");

    const fetched = await getEvent(store, created.event.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.event.location).toBe("Sydney");
    expect(fetched.event.startTime).toBe(START);
  });

  it("rejects create without events.edit", async () => {
    const store = openMemoryTenant();
    const result = await createEvent(store, memberActor(), {
      startTime: START,
      title: "Nope",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.status).toBe(403);
  });

  it("rejects invalid meeting and Luma URLs", async () => {
    const store = openMemoryTenant();
    const meeting = await createEvent(store, adminActor(), {
      meetingUrl: "https://evil.example/meet",
      startTime: START,
      title: "Bad meet",
    });
    expect(meeting.ok).toBe(false);

    const luma = await createEvent(store, adminActor(), {
      lumaUrl: "http://luma.com/x",
      startTime: START,
      title: "Bad luma",
    });
    expect(luma.ok).toBe(false);
  });

  it("rejects an out-of-range title and an invalid timezone via the module zod schema", async () => {
    const store = openMemoryTenant();
    const tooLong = await createEvent(store, adminActor(), {
      startTime: START,
      title: "x".repeat(201),
    });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.error.status).toBe(400);
    }

    const badTimezone = await createEvent(store, adminActor(), {
      startTime: START,
      timezone: "not a tz!",
      title: "Bad tz",
    });
    expect(badTimezone.ok).toBe(false);
    if (!badTimezone.ok) {
      expect(badTimezone.error.status).toBe(400);
    }
  });

  it("round-trips the canonical coverUrl through create, read, and update", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      coverUrl: "https://images.lumacdn.com/cover.png",
      startTime: START,
      title: "Cover art",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.event.coverUrl).toBe("https://images.lumacdn.com/cover.png");

    const fetched = await getEvent(store, created.event.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.event.coverUrl).toBe("https://images.lumacdn.com/cover.png");

    const updated = await updateEvent(store, adminActor(), created.event.id, {
      coverUrl: "/api/files/sydney/cover.png",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.event.coverUrl).toBe("/api/files/sydney/cover.png");
  });

  it("rejects a cover image from a disallowed host", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      coverUrl: "https://evil.example/cover.png",
      startTime: START,
      title: "Bad cover",
    });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error.status).toBe(400);
    expect(created.error.message).toContain("coverUrl");
  });

  it("omits the private meetingUrl from the public event payload", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      isOnline: true,
      meetingUrl: "https://zoom.us/j/123",
      startTime: START,
      title: "Online meetup",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.event.meetingUrl).toBe("https://zoom.us/j/123");

    const publicEvent = toPublicEventDetail(created.event);
    expect(Object.hasOwn(publicEvent, "meetingUrl")).toBe(false);
    expect(JSON.stringify(publicEvent)).not.toContain("zoom.us");
    // The rest of EventDetail stays public page content.
    expect(publicEvent.title).toBe("Online meetup");
    expect(publicEvent.isOnline).toBe(true);
  });

  it("treats a null eventType on update as absent instead of writing NULL", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      eventType: "workshop",
      startTime: START,
      title: "Typed",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.event.eventType).toBe("workshop");

    const updated = await updateEvent(store, adminActor(), created.event.id, {
      description: "Updated",
      eventType: null,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.event.eventType).toBe("workshop");
    expect(updated.event.description).toBe("Updated");
  });

  it("lists only published events unless includeInactive is set", async () => {
    const store = openMemoryTenant();
    const live = await createEvent(store, adminActor(), {
      startTime: START,
      title: "Live",
    });
    const draft = await createEvent(store, adminActor(), {
      isActive: false,
      startTime: START,
      title: "Draft",
    });
    expect(live.ok && draft.ok).toBe(true);
    if (!(live.ok && draft.ok)) {
      return;
    }

    const publicList = await listEvents(store);
    expect(publicList.ok).toBe(true);
    if (!publicList.ok) {
      return;
    }
    expect(publicList.events.map((e) => e.title)).toEqual(["Live"]);

    const all = await listEvents(store, { includeInactive: true });
    expect(all.ok).toBe(true);
    if (!all.ok) {
      return;
    }
    expect(all.events.map((e) => e.title).sort()).toEqual(["Draft", "Live"]);
  });

  it("hides inactive events from public get", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      isActive: false,
      startTime: START,
      title: "Hidden",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const hidden = await getEvent(store, created.event.id);
    expect(hidden.ok).toBe(false);
    if (hidden.ok) {
      return;
    }
    expect(hidden.error.status).toBe(404);

    const adminView = await getEvent(store, created.event.id, { includeInactive: true });
    expect(adminView.ok).toBe(true);
  });

  it("updates fields and publishes via setEventActive", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      isActive: false,
      startTime: START,
      title: "WIP",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const updated = await updateEvent(store, adminActor(), created.event.id, {
      location: "Melbourne",
      title: "Ready",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.event.title).toBe("Ready");

    const activated = await setEventActive(store, adminActor(), created.event.id, true);
    expect(activated.ok).toBe(true);
    const fetched = await getEvent(store, created.event.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.event.status).toBe("published");
    expect(fetched.event.location).toBe("Melbourne");
  });

  it("deletes an event so it is no longer retrievable", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: START,
      title: "Gone",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const removed = await deleteEvent(store, adminActor(), created.event.id);
    expect(removed.ok).toBe(true);
    const fetched = await getEvent(store, created.event.id, { includeInactive: true });
    expect(fetched.ok).toBe(false);
  });

  it("rejects delete without events.delete", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: START,
      title: "Keep",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const result = await deleteEvent(store, memberActor(), created.event.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.status).toBe(403);
  });
});

describe("event RSVP", () => {
  it("records going and interested, then clears on not_going", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      rsvpEnabled: true,
      startTime: START,
      title: "RSVP Night",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const going = await rsvpToEvent(store, memberActor(), created.event.id, "going");
    expect(going.ok).toBe(true);
    if (!going.ok) {
      return;
    }
    expect(going.status).toBe("going");
    expect(going.counts.going).toBe(1);

    const interested = await rsvpToEvent(store, memberActor(), created.event.id, "interested");
    expect(interested.ok).toBe(true);
    if (!interested.ok) {
      return;
    }
    expect(interested.counts).toEqual({ going: 0, interested: 1 });

    const left = await rsvpToEvent(store, memberActor(), created.event.id, "not_going");
    expect(left.ok).toBe(true);
    if (!left.ok) {
      return;
    }
    expect(left.status).toBeNull();

    const stats = await getRsvpStats(store, created.event.id, memberActor());
    expect(stats.ok).toBe(true);
    if (!stats.ok) {
      return;
    }
    expect(stats.userRsvp).toBeNull();
    expect(stats.counts.total).toBe(0);
  });

  it("rejects RSVP when Luma is set or internal RSVP is off", async () => {
    const store = openMemoryTenant();
    const luma = await createEvent(store, adminActor(), {
      lumaUrl: "https://lu.ma/night",
      rsvpEnabled: true,
      startTime: START,
      title: "Luma Event",
    });
    expect(luma.ok).toBe(true);
    if (!luma.ok) {
      return;
    }
    const blocked = await rsvpToEvent(store, memberActor(), luma.event.id, "going");
    expect(blocked.ok).toBe(false);

    const off = await createEvent(store, adminActor(), {
      startTime: START,
      title: "No RSVP",
    });
    expect(off.ok).toBe(true);
    if (!off.ok) {
      return;
    }
    const disabled = await rsvpToEvent(store, memberActor(), off.event.id, "going");
    expect(disabled.ok).toBe(false);
  });

  it("enforces going capacity", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      maxAttendees: 1,
      rsvpEnabled: true,
      startTime: START,
      title: "Tiny",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const first = await rsvpToEvent(store, memberActor({ id: "usr_a" }), created.event.id, "going");
    expect(first.ok).toBe(true);
    const second = await rsvpToEvent(
      store,
      memberActor({ id: "usr_b" }),
      created.event.id,
      "going",
    );
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.error.message).toBe("Event is at maximum capacity");
  });
});

describe("event agenda", () => {
  it("adds, lists, and reorders agenda items", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: START,
      title: "Agenda Night",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const welcome = await addAgendaItem(store, adminActor(), created.event.id, {
      title: "Doors",
      type: "welcome",
    });
    const custom = await addAgendaItem(store, adminActor(), created.event.id, {
      title: "Talks",
      type: "custom",
    });
    expect(welcome.ok && custom.ok).toBe(true);
    if (!(welcome.ok && custom.ok)) {
      return;
    }

    const listed = await listAgenda(store, adminActor(), created.event.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.items.map((i) => i.title)).toEqual(["Doors", "Talks"]);

    const reordered = await reorderAgenda(store, adminActor(), created.event.id, [
      { id: custom.item.id },
      { id: welcome.item.id },
    ]);
    expect(reordered.ok).toBe(true);
    const after = await listAgenda(store, adminActor(), created.event.id);
    expect(after.ok).toBe(true);
    if (!after.ok) {
      return;
    }
    expect(after.items.map((i) => i.title)).toEqual(["Talks", "Doors"]);

    const renamed = await updateAgendaItem(store, adminActor(), custom.item.id, {
      title: "Keynotes",
    });
    expect(renamed.ok).toBe(true);
    const removed = await deleteAgendaItem(store, adminActor(), welcome.item.id);
    expect(removed.ok).toBe(true);
    const leftover = await listAgenda(store, adminActor(), created.event.id);
    expect(leftover.ok).toBe(true);
    if (!leftover.ok) {
      return;
    }
    expect(leftover.items.map((i) => i.title)).toEqual(["Keynotes"]);
  });

  it("rejects agenda writes without events.edit", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: START,
      title: "Locked",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const result = await addAgendaItem(store, memberActor(), created.event.id, {
      title: "Nope",
    });
    expect(result.ok).toBe(false);
  });
});

describe("luma interest", () => {
  it("registers interest only when the event is upcoming and has no Luma URL", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: FUTURE,
      title: "Waitlist",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const registered = await registerLumaInterest(store, memberActor(), created.event.id, {
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) {
      return;
    }
    expect(registered.registered).toBe(true);

    const status = await getLumaInterestStatus(store, created.event.id, memberActor());
    expect(status.ok).toBe(true);
    if (!status.ok) {
      return;
    }
    expect(status.registered).toBe(true);
    expect(status.count).toBe(1);

    const cleared = await unregisterLumaInterest(store, memberActor(), created.event.id);
    expect(cleared.ok).toBe(true);
    const after = await getLumaWaitlistCount(store, created.event.id);
    expect(after.ok).toBe(true);
    if (!after.ok) {
      return;
    }
    expect(after.count).toBe(0);
  });

  it("does not burn the waitlist when a Luma URL is set without a notifier", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: FUTURE,
      title: "Hold",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await registerLumaInterest(store, memberActor(), created.event.id, {
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });

    const updated = await updateEvent(store, adminActor(), created.event.id, {
      lumaUrl: "https://lu.ma/hold",
    });
    expect(updated.ok).toBe(true);

    const pending = await notifyLumaWaitlist(store, created.event.id, {
      notify: ({ userId }) => {
        expect(userId).toBe("usr_member");
        return Promise.resolve();
      },
    });
    expect(pending.ok).toBe(true);
    if (!pending.ok) {
      return;
    }
    expect(pending.notified).toBe(1);
  });

  it("does not stamp the waitlist when notify throws", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: FUTURE,
      title: "Retry",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await registerLumaInterest(store, memberActor(), created.event.id, {
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });
    await updateEvent(store, adminActor(), created.event.id, {
      lumaUrl: "https://lu.ma/retry",
    });

    const failed = await notifyLumaWaitlist(store, created.event.id, {
      notify: () => Promise.reject(new Error("smtp down")),
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      return;
    }
    expect(failed.notified).toBe(0);
    expect(failed.failedEmails).toBe(1);

    const retried = await notifyLumaWaitlist(store, created.event.id, {
      notify: () => Promise.resolve(),
    });
    expect(retried.ok).toBe(true);
    if (!retried.ok) {
      return;
    }
    expect(retried.notified).toBe(1);
  });

  it("rejects interest once a Luma URL exists", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      lumaUrl: "https://lu.ma/linked",
      startTime: FUTURE,
      title: "Linked",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const result = await registerLumaInterest(store, memberActor(), created.event.id);
    expect(result.ok).toBe(false);
  });

  it("notifies the waitlist once when a Luma URL is set", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: FUTURE,
      title: "Soon",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await registerLumaInterest(store, memberActor(), created.event.id, {
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });

    const notified: string[] = [];
    const updated = await updateEvent(
      store,
      adminActor(),
      created.event.id,
      { lumaUrl: "https://lu.ma/soon" },
      {
        notify: ({ userId }) => {
          notified.push(userId);
          return Promise.resolve();
        },
      },
    );
    expect(updated.ok).toBe(true);
    expect(notified).toEqual(["usr_member"]);

    const again = await notifyLumaWaitlist(store, created.event.id, {
      notify: ({ userId }) => {
        notified.push(userId);
        return Promise.resolve();
      },
    });
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.notified).toBe(0);

    const remaining = await listLumaInterestsForUser(store, memberActor(), {
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(remaining.ok).toBe(true);
    if (!remaining.ok) {
      return;
    }
    expect(remaining.events).toEqual([]);
  });

  it("lists published events for the sitemap", async () => {
    const store = openMemoryTenant();
    await createEvent(store, adminActor(), { startTime: START, title: "Public" });
    await createEvent(store, adminActor(), {
      isActive: false,
      startTime: START,
      title: "Hidden",
    });
    const sitemap = await listEventSitemapEntries(store);
    expect(sitemap.ok).toBe(true);
    if (!sitemap.ok) {
      return;
    }
    expect(sitemap.entries).toHaveLength(1);
    expect(sitemap.entries[0]?.slug).toBe("public-september-2026");
  });

  it("adds and lists event resources", async () => {
    const store = openMemoryTenant();
    const created = await createEvent(store, adminActor(), {
      startTime: START,
      title: "Workshop",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const denied = await addEventResource(store, memberActor(), created.event.slug, {
      fileUrl: "https://example.com/slides.pdf",
      title: "Slides",
    });
    expect(denied.ok).toBe(false);

    const added = await addEventResource(store, adminActor(), created.event.slug, {
      description: "Deck",
      fileUrl: "https://example.com/slides.pdf",
      title: "Slides",
    });
    expect(added.ok).toBe(true);
    const listed = await listEventResources(store, created.event.slug);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.resources).toHaveLength(1);
      expect(listed.resources[0]?.title).toBe("Slides");
    }
  });
});
