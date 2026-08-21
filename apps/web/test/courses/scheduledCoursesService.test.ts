import { describe, expect, it } from "vitest";

import {
  createScheduledCourse,
  getScheduledCourse,
  listPublishedScheduled,
  removeScheduledCourse,
  updateScheduledCourse,
} from "@/modules/courses/services/coursesService";

import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

const START = "2026-10-01T09:00:00.000Z";

describe("scheduledCoursesService", () => {
  it("creates a date slug, hides drafts, and lists published upcoming", async () => {
    const store = openMemoryTenant();
    const created = await createScheduledCourse(store, adminActor(), {
      startTime: START,
      title: "Claude Workshop",
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.course.slug).toBe("claude-workshop-october-2026");
    expect(created.course.isPublished).toBeFalsy();

    const hidden = await listPublishedScheduled(store);
    expect(hidden.ok && hidden.courses).toStrictEqual([]);

    const published = await updateScheduledCourse(store, adminActor(), created.course.id, {
      isPublished: true,
    });
    expect(published.ok).toBeTruthy();

    const listed = await listPublishedScheduled(store, { upcoming: true });
    expect(listed.ok).toBeTruthy();
    if (listed.ok) {
      expect(listed.courses.map((c) => c.slug)).toStrictEqual(["claude-workshop-october-2026"]);
    }
  });

  it("rejects create without courses.edit and invalid startTime", async () => {
    const store = openMemoryTenant();
    const denied = await createScheduledCourse(store, memberActor(), {
      startTime: START,
      title: "Nope",
    });
    expect(denied.ok).toBeFalsy();
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const bad = await createScheduledCourse(store, adminActor(), {
      startTime: "not-a-date",
      title: "Bad",
    });
    expect(bad.ok).toBeFalsy();
    if (!bad.ok) {
      expect(bad.error.status).toBe(400);
    }
  });

  it("keeps the slug on a same-title update and deletes with courses.delete", async () => {
    const store = openMemoryTenant();
    const created = await createScheduledCourse(store, adminActor(), {
      isPublished: true,
      startTime: START,
      title: "Bootcamp",
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }

    const updated = await updateScheduledCourse(store, adminActor(), created.course.id, {
      location: "Sydney",
      title: "Renamed Bootcamp",
    });
    expect(updated.ok).toBeTruthy();
    if (updated.ok) {
      expect(updated.course.slug).toBe(created.course.slug);
      expect(updated.course.title).toBe("Renamed Bootcamp");
      expect(updated.course.location).toBe("Sydney");
    }

    const fetched = await getScheduledCourse(store, created.course.slug);
    expect(fetched.ok).toBeTruthy();

    const removed = await removeScheduledCourse(store, adminActor(), created.course.id);
    expect(removed.ok).toBeTruthy();
    const missing = await getScheduledCourse(store, created.course.id, adminActor());
    expect(missing.ok).toBeFalsy();
  });
});
