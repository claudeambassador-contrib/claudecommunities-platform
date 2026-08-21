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
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.course.lessons).toHaveLength(1);

    const hidden = await listPublished(store);
    expect(hidden.ok).toBeTruthy();
    if (!hidden.ok) {
      return;
    }
    expect(hidden.courses).toStrictEqual([]);

    const published = await updateCourse(store, adminActor(), created.course.id, {
      isPublished: true,
    });
    expect(published.ok).toBeTruthy();

    const listed = await listPublished(store);
    expect(listed.ok).toBeTruthy();
    if (!listed.ok) {
      return;
    }
    expect(listed.courses.map((c) => c.slug)).toStrictEqual(["intro"]);
  });

  it("rejects create without courses.edit and duplicate slugs", async () => {
    const store = openMemoryTenant();
    const denied = await createCourse(store, memberActor(), {
      slug: "x",
      title: "Nope",
    });
    expect(denied.ok).toBeFalsy();

    const first = await createCourse(store, adminActor(), { slug: "dup", title: "A" });
    expect(first.ok).toBeTruthy();
    const clash = await createCourse(store, adminActor(), { slug: "dup", title: "B" });
    expect(clash.ok).toBeFalsy();
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
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    const first = await enrollInCourse(store, memberActor(), created.course.id);
    expect(first.ok).toBeTruthy();
    const again = await enrollInCourse(store, memberActor(), created.course.id);
    expect(again.ok).toBeTruthy();

    const fetched = await getCourse(store, created.course.id, memberActor());
    expect(fetched.ok).toBeTruthy();
    if (!fetched.ok) {
      return;
    }
    expect(fetched.course.enrolled).toBeTruthy();
  });

  it("hides drafts from members and allows admin list/delete", async () => {
    const store = openMemoryTenant();
    const created = await createCourse(store, adminActor(), {
      slug: "draft",
      title: "Draft",
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    const hidden = await getCourse(store, created.course.id, memberActor());
    expect(hidden.ok).toBeFalsy();

    const adminList = await listAllAdmin(store, adminActor());
    expect(adminList.ok).toBeTruthy();
    if (!adminList.ok) {
      return;
    }
    expect(adminList.courses).toHaveLength(1);

    const removed = await removeCourse(store, adminActor(), created.course.id);
    expect(removed.ok).toBeTruthy();
  });
});
