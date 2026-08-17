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
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.course.slug).toBe("claude-workshop-october-2026");
    expect(created.course.isPublished).toBe(false);

    const hidden = await listPublishedScheduled(store);
    expect(hidden.ok && hidden.courses).toEqual([]);

    const published = await updateScheduledCourse(store, adminActor(), created.course.id, {
      isPublished: true,
    });
    expect(published.ok).toBe(true);

    const listed = await listPublishedScheduled(store, { upcoming: true });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.courses.map((c) => c.slug)).toEqual(["claude-workshop-october-2026"]);
    }
  });

  it("rejects create without courses.edit and invalid startTime", async () => {
    const store = openMemoryTenant();
    const denied = await createScheduledCourse(store, memberActor(), {
      startTime: START,
      title: "Nope",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const bad = await createScheduledCourse(store, adminActor(), {
      startTime: "not-a-date",
      title: "Bad",
    });
    expect(bad.ok).toBe(false);
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
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const updated = await updateScheduledCourse(store, adminActor(), created.course.id, {
      location: "Sydney",
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.course.slug).toBe(created.course.slug);
      expect(updated.course.location).toBe("Sydney");
    }

    const fetched = await getScheduledCourse(store, created.course.slug);
    expect(fetched.ok).toBe(true);

    const removed = await removeScheduledCourse(store, adminActor(), created.course.id);
    expect(removed.ok).toBe(true);
    const missing = await getScheduledCourse(store, created.course.id, adminActor());
    expect(missing.ok).toBe(false);
  });
});
