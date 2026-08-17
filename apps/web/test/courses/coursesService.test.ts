import { describe, expect, it } from "vitest";
import {
  createCourse,
  enrollInCourse,
  getCourse,
  listAllAdmin,
  listPublished,
  removeCourse,
  updateCourse,
} from "@/modules/courses/services/coursesService";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

describe("coursesService", () => {
  it("creates a course with lessons and lists it only when published", async () => {
    const store = openMemoryTenant();
    const created = await createCourse(store, adminActor(), {
      lessons: [{ content: "Hi", title: "Lesson 1" }],
      slug: "intro",
      title: "Intro to Claude",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.course.lessons).toHaveLength(1);

    const hidden = await listPublished(store);
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) {
      return;
    }
    expect(hidden.courses).toEqual([]);

    const published = await updateCourse(store, adminActor(), created.course.id, {
      isPublished: true,
    });
    expect(published.ok).toBe(true);

    const listed = await listPublished(store);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.courses.map((c) => c.slug)).toEqual(["intro"]);
  });

  it("rejects create without courses.edit and duplicate slugs", async () => {
    const store = openMemoryTenant();
    const denied = await createCourse(store, memberActor(), {
      slug: "x",
      title: "Nope",
    });
    expect(denied.ok).toBe(false);

    const first = await createCourse(store, adminActor(), { slug: "dup", title: "A" });
    expect(first.ok).toBe(true);
    const clash = await createCourse(store, adminActor(), { slug: "dup", title: "B" });
    expect(clash.ok).toBe(false);
    if (!clash.ok) {
      expect(clash.error.status).toBe(409);
    }
  });

  it("enrolls a member in a published course and is idempotent", async () => {
    const store = openMemoryTenant();
    const created = await createCourse(store, adminActor(), {
      isPublished: true,
      slug: "enroll",
      title: "Enroll me",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const first = await enrollInCourse(store, memberActor(), created.course.id);
    expect(first.ok).toBe(true);
    const again = await enrollInCourse(store, memberActor(), created.course.id);
    expect(again.ok).toBe(true);

    const fetched = await getCourse(store, created.course.id, memberActor());
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.course.enrolled).toBe(true);
  });

  it("hides drafts from members and allows admin list/delete", async () => {
    const store = openMemoryTenant();
    const created = await createCourse(store, adminActor(), {
      slug: "draft",
      title: "Draft",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const hidden = await getCourse(store, created.course.id, memberActor());
    expect(hidden.ok).toBe(false);

    const adminList = await listAllAdmin(store, adminActor());
    expect(adminList.ok).toBe(true);
    if (!adminList.ok) {
      return;
    }
    expect(adminList.courses).toHaveLength(1);

    const removed = await removeCourse(store, adminActor(), created.course.id);
    expect(removed.ok).toBe(true);
  });
});
