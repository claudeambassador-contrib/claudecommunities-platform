import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import type {
  CourseDetail,
  CourseListItem,
  LessonDetail,
  LessonInput,
  ScheduledCourseDetail,
  ScheduledCourseWrite,
} from "@/modules/courses/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

async function lessonCount(store: TenantStore, courseId: string): Promise<number> {
  const { lessons } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(lessons)
    .where(and(eq(lessons.orgId, store.orgId), eq(lessons.courseId, courseId)));
  return Number(first(rows)?.n ?? 0);
}

async function enrollmentCount(store: TenantStore, courseId: string): Promise<number> {
  const { courseEnrollments } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.orgId, store.orgId), eq(courseEnrollments.courseId, courseId)));
  return Number(first(rows)?.n ?? 0);
}

export async function isEnrolled(
  store: TenantStore,
  courseId: string,
  userId: string,
): Promise<boolean> {
  const { courseEnrollments } = store.tables;
  const rows = await store.db
    .select()
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.orgId, store.orgId),
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(first(rows));
}

async function listLessons(store: TenantStore, courseId: string): Promise<LessonDetail[]> {
  const { lessons } = store.tables;
  const rows = await store.db
    .select()
    .from(lessons)
    .where(and(eq(lessons.orgId, store.orgId), eq(lessons.courseId, courseId)))
    .orderBy(asc(lessons.sortOrder));
  return rows.map((row) => ({
    content: row.body ?? null,
    id: row.id,
    order: row.sortOrder,
    title: row.title,
  }));
}

export async function findBySlug(store: TenantStore, slug: string, ignoreId?: string) {
  const { courses } = store.tables;
  const rows = await store.db
    .select()
    .from(courses)
    .where(and(eq(courses.orgId, store.orgId), eq(courses.slug, slug)))
    .limit(1);
  const row = first(rows);
  if (!row || row.id === ignoreId) {
    return null;
  }
  return row;
}

export async function listCourses(
  store: TenantStore,
  options: { publishedOnly?: boolean } = {},
): Promise<CourseListItem[]> {
  const { courses } = store.tables;
  const rows = await store.db
    .select()
    .from(courses)
    .where(
      options.publishedOnly
        ? and(eq(courses.orgId, store.orgId), eq(courses.status, "published"))
        : eq(courses.orgId, store.orgId),
    )
    .orderBy(desc(courses.createdAt));
  return Promise.all(
    rows.map(async (row) => ({
      enrollmentCount: await enrollmentCount(store, row.id),
      id: row.id,
      lessonCount: await lessonCount(store, row.id),
      slug: row.slug,
      status: row.status,
      title: row.title,
    })),
  );
}

export async function getById(
  store: TenantStore,
  id: string,
  viewerId?: string,
): Promise<Result<{ course: CourseDetail }>> {
  const { courses } = store.tables;
  const rows = await store.db
    .select()
    .from(courses)
    .where(and(eq(courses.orgId, store.orgId), eq(courses.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Course not found");
  }
  return ok({
    course: {
      description: row.description ?? null,
      enrolled: viewerId ? await isEnrolled(store, id, viewerId) : false,
      enrollmentCount: await enrollmentCount(store, id),
      id: row.id,
      lessons: await listLessons(store, id),
      slug: row.slug,
      status: row.status,
      title: row.title,
    },
  });
}

export async function insertCourse(
  store: TenantStore,
  input: {
    description?: string | null;
    lessons?: LessonInput[];
    slug: string;
    status: "draft" | "published";
    title: string;
  },
): Promise<CourseDetail> {
  const { courses } = store.tables;
  const now = new Date();
  const id = newId("crs");
  await store.db.insert(courses).values({
    createdAt: now,
    description: input.description ?? null,
    id,
    orgId: store.orgId,
    slug: input.slug,
    status: input.status,
    title: input.title,
    updatedAt: now,
  });
  if (input.lessons?.length) {
    await replaceLessons(store, id, input.lessons);
  }
  const created = await getById(store, id);
  if (!created.ok) {
    throw new Error("insert course failed");
  }
  return created.course;
}

export async function updateCourse(
  store: TenantStore,
  id: string,
  patch: {
    description?: string | null;
    lessons?: LessonInput[];
    slug?: string;
    status?: "draft" | "published";
    title?: string;
  },
): Promise<Result<{ course: CourseDetail }>> {
  const existing = await getById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { courses } = store.tables;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    set.title = patch.title;
  }
  if (patch.slug !== undefined) {
    set.slug = patch.slug;
  }
  if (patch.description !== undefined) {
    set.description = patch.description;
  }
  if (patch.status !== undefined) {
    set.status = patch.status;
  }
  await store.db
    .update(courses)
    .set(set)
    .where(and(eq(courses.orgId, store.orgId), eq(courses.id, id)));
  if (patch.lessons) {
    await replaceLessons(store, id, patch.lessons);
  }
  return getById(store, id);
}

export async function deleteCourse(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { courses } = store.tables;
  await store.db.delete(courses).where(and(eq(courses.orgId, store.orgId), eq(courses.id, id)));
  return ok({ success: true });
}

export async function replaceLessons(
  store: TenantStore,
  courseId: string,
  incoming: LessonInput[],
): Promise<void> {
  const { lessons } = store.tables;
  await store.db
    .delete(lessons)
    .where(and(eq(lessons.orgId, store.orgId), eq(lessons.courseId, courseId)));
  const now = new Date();
  await Promise.all(
    incoming.map((lesson, index) =>
      store.db.insert(lessons).values({
        body: lesson.content ?? null,
        courseId,
        createdAt: now,
        id: lesson.id ?? newId("lsn"),
        orgId: store.orgId,
        sortOrder: lesson.order ?? index + 1,
        title: lesson.title,
      }),
    ),
  );
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toScheduled(
  row: TenantStore["tables"]["scheduledCourses"]["$inferSelect"],
): ScheduledCourseDetail {
  return {
    city: row.city,
    courseType: row.courseType,
    description: row.description,
    endTime: iso(row.endTime),
    id: row.id,
    imageUrl: row.imageUrl,
    instructor: row.instructor,
    isOnline: Boolean(row.isOnline),
    isPublished: Boolean(row.isPublished),
    location: row.location,
    maxAttendees: row.maxAttendees,
    meetingUrl: row.meetingUrl,
    price: row.price,
    registrationUrl: row.registrationUrl,
    slug: row.slug,
    startTime: row.startTime.toISOString(),
    timezone: row.timezone,
    title: row.title,
  };
}

export async function findScheduledBySlug(
  store: TenantStore,
  slug: string,
  ignoreId?: string,
): Promise<ScheduledCourseDetail | null> {
  const { scheduledCourses } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(scheduledCourses)
      .where(and(eq(scheduledCourses.orgId, store.orgId), eq(scheduledCourses.slug, slug)))
      .limit(1),
  );
  if (!row || row.id === ignoreId) {
    return null;
  }
  return toScheduled(row);
}

export async function listScheduled(
  store: TenantStore,
  options: { publishedOnly?: boolean; upcoming?: boolean } = {},
): Promise<ScheduledCourseDetail[]> {
  const { scheduledCourses } = store.tables;
  const filters = [eq(scheduledCourses.orgId, store.orgId)];
  if (options.publishedOnly) {
    filters.push(eq(scheduledCourses.isPublished, true));
  }
  if (options.upcoming) {
    filters.push(gte(scheduledCourses.startTime, new Date()));
  }
  const rows = await store.db
    .select()
    .from(scheduledCourses)
    .where(and(...filters))
    .orderBy(asc(scheduledCourses.startTime));
  return rows.map(toScheduled);
}

export async function getScheduledByIdOrSlug(
  store: TenantStore,
  idOrSlug: string,
): Promise<Result<{ course: ScheduledCourseDetail }>> {
  const { scheduledCourses } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(scheduledCourses)
      .where(
        and(
          eq(scheduledCourses.orgId, store.orgId),
          or(eq(scheduledCourses.id, idOrSlug), eq(scheduledCourses.slug, idOrSlug)),
        ),
      )
      .limit(1),
  );
  if (!row) {
    return err("not_found", 404, "Scheduled course not found");
  }
  return ok({ course: toScheduled(row) });
}

export async function insertScheduled(
  store: TenantStore,
  write: ScheduledCourseWrite,
): Promise<Result<{ course: ScheduledCourseDetail }>> {
  const { scheduledCourses } = store.tables;
  const now = new Date();
  const id = newId("sc");
  try {
    await store.db.insert(scheduledCourses).values({
      city: write.city ?? null,
      courseType: write.courseType ?? "workshop",
      createdAt: now,
      description: write.description ?? null,
      endTime: write.endTime ?? null,
      id,
      imageUrl: write.imageUrl ?? null,
      instructor: write.instructor ?? null,
      isOnline: write.isOnline ?? false,
      isPublished: write.isPublished ?? false,
      location: write.location ?? null,
      maxAttendees: write.maxAttendees ?? null,
      meetingUrl: write.meetingUrl ?? null,
      orgId: store.orgId,
      price: write.price ?? null,
      registrationUrl: write.registrationUrl ?? null,
      slug: write.slug,
      startTime: write.startTime,
      timezone: write.timezone ?? null,
      title: write.title,
      updatedAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (UNIQUE_CONSTRAINT.test(message)) {
      return err("conflict", 409, "A scheduled course with this slug already exists");
    }
    throw error;
  }
  return getScheduledByIdOrSlug(store, id);
}

function scheduledPatch(write: Partial<ScheduledCourseWrite>): Record<string, unknown> {
  return {
    ...(write.city === undefined ? {} : { city: write.city }),
    ...(write.courseType === undefined ? {} : { courseType: write.courseType }),
    ...(write.description === undefined ? {} : { description: write.description }),
    ...(write.endTime === undefined ? {} : { endTime: write.endTime }),
    ...(write.imageUrl === undefined ? {} : { imageUrl: write.imageUrl }),
    ...(write.instructor === undefined ? {} : { instructor: write.instructor }),
    ...(write.isOnline === undefined ? {} : { isOnline: write.isOnline }),
    ...(write.isPublished === undefined ? {} : { isPublished: write.isPublished }),
    ...(write.location === undefined ? {} : { location: write.location }),
    ...(write.maxAttendees === undefined ? {} : { maxAttendees: write.maxAttendees }),
    ...(write.meetingUrl === undefined ? {} : { meetingUrl: write.meetingUrl }),
    ...(write.price === undefined ? {} : { price: write.price }),
    ...(write.registrationUrl === undefined ? {} : { registrationUrl: write.registrationUrl }),
    ...(write.slug === undefined ? {} : { slug: write.slug }),
    ...(write.startTime === undefined ? {} : { startTime: write.startTime }),
    ...(write.timezone === undefined ? {} : { timezone: write.timezone }),
    ...(write.title === undefined ? {} : { title: write.title }),
    updatedAt: new Date(),
  };
}

export async function updateScheduled(
  store: TenantStore,
  id: string,
  write: Partial<ScheduledCourseWrite>,
): Promise<Result<{ course: ScheduledCourseDetail }>> {
  const existing = await getScheduledByIdOrSlug(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { scheduledCourses } = store.tables;
  try {
    await store.db
      .update(scheduledCourses)
      .set(scheduledPatch(write))
      .where(and(eq(scheduledCourses.orgId, store.orgId), eq(scheduledCourses.id, id)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (UNIQUE_CONSTRAINT.test(message)) {
      return err("conflict", 409, "A scheduled course with this slug already exists");
    }
    throw error;
  }
  return getScheduledByIdOrSlug(store, id);
}

export async function deleteScheduled(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getScheduledByIdOrSlug(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { scheduledCourses } = store.tables;
  await store.db
    .delete(scheduledCourses)
    .where(and(eq(scheduledCourses.orgId, store.orgId), eq(scheduledCourses.id, id)));
  return ok({ success: true });
}

export async function insertEnrollment(
  store: TenantStore,
  courseId: string,
  userId: string,
): Promise<void> {
  if (await isEnrolled(store, courseId, userId)) {
    return;
  }
  const { courseEnrollments } = store.tables;
  await store.db.insert(courseEnrollments).values({
    courseId,
    createdAt: new Date(),
    id: newId("enr"),
    orgId: store.orgId,
    userId,
  });
}
