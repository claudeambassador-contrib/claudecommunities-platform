// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as coursesRepo from "@/modules/courses/repositories/coursesRepository";
import type {
  CourseCreateBody,
  CourseDetail,
  CourseListItem,
  CourseUpdateBody,
} from "@/modules/courses/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

function statusFromPublished(isPublished?: boolean): "draft" | "published" {
  return isPublished ? "published" : "draft";
}

export async function listPublished(
  store: TenantStore,
): Promise<Result<{ courses: CourseListItem[] }>> {
  return ok({ courses: await coursesRepo.listCourses(store, { publishedOnly: true }) });
}

export async function listAllAdmin(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ courses: CourseListItem[] }>> {
  const perm = ensurePermission(actor, "courses.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ courses: await coursesRepo.listCourses(store) });
}

export async function getCourse(
  store: TenantStore,
  id: string,
  viewer?: Actor | null,
): Promise<Result<{ course: CourseDetail }>> {
  const found = await coursesRepo.getById(store, id, viewer?.id);
  if (!found.ok) {
    return found;
  }
  if (found.course.status !== "published" && !viewer?.permissions.has("courses.view")) {
    return err("not_found", 404, "Course not found");
  }
  return found;
}

export async function createCourse(
  store: TenantStore,
  actor: Actor,
  input: CourseCreateBody,
): Promise<Result<{ course: CourseDetail }>> {
  const perm = ensurePermission(actor, "courses.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!(input.title && input.slug)) {
    return err("bad_request", 400, "Title and slug are required");
  }
  if (await coursesRepo.findBySlug(store, input.slug)) {
    return err("conflict", 409, "A course with this slug already exists");
  }
  return ok({
    course: await coursesRepo.insertCourse(store, {
      description: input.description,
      lessons: input.lessons,
      slug: input.slug,
      status: statusFromPublished(input.isPublished),
      title: input.title,
    }),
  });
}

export async function updateCourse(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: CourseUpdateBody,
): Promise<Result<{ course: CourseDetail }>> {
  const perm = ensurePermission(actor, "courses.edit");
  if (!perm.ok) {
    return perm;
  }
  if (input.slug && (await coursesRepo.findBySlug(store, input.slug, id))) {
    return err("conflict", 409, "A course with this slug already exists");
  }
  return coursesRepo.updateCourse(store, id, {
    description: input.description,
    lessons: input.lessons,
    slug: input.slug,
    status: input.isPublished === undefined ? undefined : statusFromPublished(input.isPublished),
    title: input.title,
  });
}

export async function removeCourse(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "courses.delete");
  if (!perm.ok) {
    return perm;
  }
  return await coursesRepo.deleteCourse(store, id);
}

export async function enrollInCourse(
  store: TenantStore,
  actor: Actor,
  courseId: string,
): Promise<Result<{ success: true }>> {
  const found = await coursesRepo.getById(store, courseId);
  if (!found.ok || found.course.status !== "published") {
    return err("not_found", 404, "Course not found");
  }
  await coursesRepo.insertEnrollment(store, courseId, actor.id);
  return ok({ success: true });
}
