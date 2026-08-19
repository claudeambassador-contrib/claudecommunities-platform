// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as coursesRepo from "@/modules/courses/repositories/coursesRepository";
import type {
  CourseCreateBody,
  CourseDetail,
  CourseListItem,
  CourseUpdateBody,
  ScheduledCourseDetail,
  ScheduledCourseInput,
  ScheduledCourseUpdate,
  ScheduledCourseWrite,
} from "@/modules/courses/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { toSafeSlug } from "@/shared/ids";

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

export async function getPublishedBySlug(
  store: TenantStore,
  slug: string,
  viewer?: Actor | null,
): Promise<Result<{ course: CourseDetail }>> {
  const row = await coursesRepo.findBySlug(store, slug);
  if (!row) {
    return err("not_found", 404, "Course not found");
  }
  return getCourse(store, row.id, viewer);
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

function parseDate(value: string | null | undefined, field: string): Result<{ date: Date | null }> {
  if (!value) {
    return ok({ date: null });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return err("bad_request", 400, `Invalid ${field}`);
  }
  return ok({ date });
}

function parseMaxAttendees(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value > 0 ? value : null;
}

function buildDateSlug(title: string, startTime: Date): string {
  const month = startTime.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const year = startTime.getFullYear();
  return `${toSafeSlug(title)}-${month}-${year}`;
}

async function uniqueScheduledSlug(
  store: TenantStore,
  base: string,
  ignoreId?: string,
): Promise<string> {
  let candidate = base;
  let n = 1;
  // biome-ignore lint/performance/noAwaitInLoops: uniqueness is checked one slug at a time
  while (await coursesRepo.findScheduledBySlug(store, candidate, ignoreId)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

function toScheduledWrite(
  input: ScheduledCourseUpdate,
  start: Date,
  end: Date | null,
  slug: string,
): ScheduledCourseWrite {
  return {
    city: input.city,
    courseType: input.courseType,
    description: input.description,
    endTime: end,
    imageUrl: input.imageUrl,
    instructor: input.instructor,
    isOnline: input.isOnline,
    isPublished: input.isPublished,
    location: input.location,
    maxAttendees: parseMaxAttendees(input.maxAttendees),
    meetingUrl: input.meetingUrl,
    price: input.price,
    registrationUrl: input.registrationUrl,
    slug,
    startTime: start,
    timezone: input.timezone,
    title: input.title ?? "",
  };
}

export async function listPublishedScheduled(
  store: TenantStore,
  options: { upcoming?: boolean } = {},
): Promise<Result<{ courses: ScheduledCourseDetail[] }>> {
  return ok({
    courses: await coursesRepo.listScheduled(store, {
      publishedOnly: true,
      upcoming: options.upcoming,
    }),
  });
}

export async function getScheduledCourse(
  store: TenantStore,
  idOrSlug: string,
  viewer?: Actor | null,
): Promise<Result<{ course: ScheduledCourseDetail }>> {
  const found = await coursesRepo.getScheduledByIdOrSlug(store, idOrSlug);
  if (!found.ok) {
    return found;
  }
  if (!(found.course.isPublished || viewer?.permissions.has("courses.view"))) {
    return err("not_found", 404, "Scheduled course not found");
  }
  return found;
}

export async function createScheduledCourse(
  store: TenantStore,
  actor: Actor,
  input: ScheduledCourseInput,
): Promise<Result<{ course: ScheduledCourseDetail }>> {
  const perm = ensurePermission(actor, "courses.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!input.title) {
    return err("bad_request", 400, "title required");
  }
  const start = parseDate(input.startTime, "startTime");
  if (!start.ok) {
    return start;
  }
  if (!start.date) {
    return err("bad_request", 400, "startTime required");
  }
  const end = parseDate(input.endTime, "endTime");
  if (!end.ok) {
    return end;
  }
  const slug = await uniqueScheduledSlug(store, buildDateSlug(input.title, start.date));
  return coursesRepo.insertScheduled(store, toScheduledWrite(input, start.date, end.date, slug));
}

function scheduledUpdateWrite(
  input: ScheduledCourseUpdate,
  start: Date,
  end: Date | null | undefined,
): Partial<ScheduledCourseWrite> {
  return {
    ...(input.city === undefined ? {} : { city: input.city }),
    ...(input.courseType === undefined ? {} : { courseType: input.courseType }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(end === undefined ? {} : { endTime: end }),
    ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
    ...(input.instructor === undefined ? {} : { instructor: input.instructor }),
    ...(input.isOnline === undefined ? {} : { isOnline: input.isOnline }),
    ...(input.isPublished === undefined ? {} : { isPublished: input.isPublished }),
    ...(input.location === undefined ? {} : { location: input.location }),
    ...(input.maxAttendees === undefined
      ? {}
      : { maxAttendees: parseMaxAttendees(input.maxAttendees) }),
    ...(input.meetingUrl === undefined ? {} : { meetingUrl: input.meetingUrl }),
    ...(input.price === undefined ? {} : { price: input.price }),
    ...(input.registrationUrl === undefined ? {} : { registrationUrl: input.registrationUrl }),
    ...(input.startTime === undefined ? {} : { startTime: start }),
    ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
    ...(input.title === undefined ? {} : { title: input.title }),
  };
}

export async function updateScheduledCourse(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: ScheduledCourseUpdate,
): Promise<Result<{ course: ScheduledCourseDetail }>> {
  const perm = ensurePermission(actor, "courses.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await coursesRepo.getScheduledByIdOrSlug(store, id);
  if (!existing.ok) {
    return existing;
  }
  let start = new Date(existing.course.startTime);
  if (input.startTime !== undefined) {
    const parsed = parseDate(input.startTime, "startTime");
    if (!parsed.ok) {
      return parsed;
    }
    if (!parsed.date) {
      return err("bad_request", 400, "startTime required");
    }
    start = parsed.date;
  }
  let end: Date | null | undefined;
  if (input.endTime !== undefined) {
    const parsed = parseDate(input.endTime, "endTime");
    if (!parsed.ok) {
      return parsed;
    }
    end = parsed.date;
  }
  return coursesRepo.updateScheduled(
    store,
    existing.course.id,
    scheduledUpdateWrite(input, start, end),
  );
}

export async function removeScheduledCourse(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "courses.delete");
  if (!perm.ok) {
    return perm;
  }
  return await coursesRepo.deleteScheduled(store, id);
}
