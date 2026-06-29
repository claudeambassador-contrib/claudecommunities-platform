/**
 * Courses service — CRUD with nested lesson writes, enrolment + tier gating.
 */
import { getPrisma } from "@/lib/prisma";
import { revalidatePathSafe } from "@/lib/revalidate";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

export interface LessonInput {
  id?: string;
  title: string;
  description?: string | null;
  content?: string | null;
  videoUrl?: string | null;
  order?: number;
}

export interface CourseInput {
  title: string;
  slug: string;
  description?: string | null;
  thumbnail?: string | null;
  isPublished?: boolean;
  difficulty?: string;
  isFree?: boolean;
  lessons?: LessonInput[];
}

export async function listPublished() {
  const prisma = await getPrisma();
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    include: { _count: { select: { lessons: true, enrollments: true } } },
    orderBy: { order: "asc" },
  });
  return courses;
}

export async function listAllAdmin(actor: ActorLike) {
  ensurePermission(actor, "courses.view");
  const prisma = await getPrisma();
  return prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lessons: { select: { id: true, title: true, order: true } },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function create(actor: ActorLike, input: CourseInput) {
  ensurePermission(actor, "courses.edit");
  const prisma = await getPrisma();
  if (!input.title || !input.slug) {
    throw new ServiceError("bad_request", "Title and slug are required");
  }

  const existing = await prisma.course.findFirst({ where: { slug: input.slug } });
  if (existing) {
    throw new ServiceError("conflict", "A course with this slug already exists");
  }

  const course = await prisma.course.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description || null,
      thumbnail: input.thumbnail || null,
      isPublished: input.isPublished || false,
      difficulty: input.difficulty ?? "beginner",
      isFree: input.isFree ?? true,
      lessons: input.lessons
        ? {
            create: input.lessons.map((lesson, index) => ({
              title: lesson.title,
              slug: `${input.slug}-lesson-${index + 1}`,
              content: lesson.content || "",
              videoUrl: lesson.videoUrl || null,
              order: lesson.order ?? index + 1,
            })),
          }
        : undefined,
    },
    include: { lessons: true },
  });

  await prisma.analyticsEvent
    .create({
      data: {
        event: "course_created",
        userId: actor.id,
        data: JSON.stringify({
          courseId: course.id,
          title: course.title,
          lessonCount: course.lessons.length,
        }),
      },
    })
    .catch((e) => console.error("analytics event failed:", e));

  revalidatePathSafe("/courses");
  return course;
}

/** Fetch a single course with its lessons for the admin edit screen. */
export async function getForEdit(actor: ActorLike, id: string) {
  ensurePermission(actor, "courses.edit");
  const prisma = await getPrisma();
  const course = await prisma.course.findUnique({
    where: { id },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!course) {
    throw new ServiceError("not_found", "Course not found");
  }
  return course;
}

export async function update(
  actor: ActorLike,
  id: string,
  input: Partial<
    Pick<
      CourseInput,
      | "title"
      | "slug"
      | "description"
      | "difficulty"
      | "isPublished"
      | "isFree"
      | "thumbnail"
      | "lessons"
    >
  >,
) {
  ensurePermission(actor, "courses.edit");
  const prisma = await getPrisma();

  if (input.slug !== undefined) {
    const clash = await prisma.course.findFirst({ where: { slug: input.slug } });
    if (clash && clash.id !== id) {
      throw new ServiceError("conflict", "A course with this slug already exists");
    }
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.difficulty !== undefined) data.difficulty = input.difficulty;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;
  if (input.isFree !== undefined) data.isFree = input.isFree;
  if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail || null;

  const course = await prisma.course.update({ where: { id }, data });

  if (input.lessons !== undefined) {
    await syncLessons(id, input.slug ?? course.slug, input.lessons);
  }

  revalidatePathSafe("/courses");
  return course;
}

/**
 * Reconcile a course's lessons against the submitted list: update existing rows
 * in place (preserving their LessonProgress), create new ones, delete the rest.
 * Sequential statements (the proven D1 pattern) rather than one nested write.
 * Order is irrelevant: kept lessons keep their slug and new ones get a random
 * slug, so the [courseId, slug] unique key never collides.
 */
async function syncLessons(courseId: string, slugBase: string, incoming: LessonInput[]) {
  const prisma = await getPrisma();
  const existing = await prisma.lesson.findMany({
    where: { courseId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((l) => l.id));
  const keptIds = incoming
    .map((l) => l.id)
    .filter((lid): lid is string => Boolean(lid) && existingIds.has(lid as string));

  await prisma.lesson.deleteMany({
    where: keptIds.length ? { courseId, id: { notIn: keptIds } } : { courseId },
  });

  for (const [i, l] of incoming.entries()) {
    const order = l.order ?? i + 1;
    if (l.id && existingIds.has(l.id)) {
      await prisma.lesson.update({
        where: { id: l.id },
        data: { title: l.title, content: l.content || "", videoUrl: l.videoUrl || null, order },
      });
    } else {
      await prisma.lesson.create({
        data: {
          courseId,
          title: l.title,
          slug: `${slugBase}-lesson-${crypto.randomUUID().slice(0, 8)}`,
          content: l.content || "",
          videoUrl: l.videoUrl || null,
          order,
        },
      });
    }
  }
}

export async function remove(actor: ActorLike, id: string) {
  ensurePermission(actor, "courses.delete");
  const prisma = await getPrisma();
  await prisma.course.delete({ where: { id } });
  revalidatePathSafe("/courses");
  return { success: true };
}

/**
 * Returns `{ allowed: true }` if the actor may enrol, otherwise throws.
 * Logic mirrors `/api/courses/enroll/route.ts`.
 */
export async function checkCourseAccess(actor: ActorLike, courseId: string) {
  const prisma = await getPrisma();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { requiredTier: true },
  });
  if (!course?.isPublished) {
    throw new ServiceError("not_found", "Course not found");
  }

  if (!course.isFree && course.requiredTierId) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: actor.id,
        status: "active",
        tierId: course.requiredTierId,
      },
    });
    if (!subscription) {
      throw new ServiceError("forbidden", "This course requires a premium subscription");
    }
  }
  return { course };
}

export async function enrollInCourse(actor: ActorLike, courseId: string) {
  const prisma = await getPrisma();
  if (!courseId) throw new ServiceError("bad_request", "Course ID is required");

  const { course } = await checkCourseAccess(actor, courseId);

  const existing = await prisma.courseEnrollment.findFirst({
    where: { userId: actor.id, courseId },
  });
  if (existing) {
    return { message: "Already enrolled" as const };
  }

  const enrollment = await prisma.courseEnrollment.create({
    data: { userId: actor.id, courseId },
  });

  await prisma.analyticsEvent
    .create({
      data: {
        event: "course_enrolled",
        userId: actor.id,
        data: JSON.stringify({ courseId, courseTitle: course.title }),
      },
    })
    .catch((e) => console.error("analytics event failed:", e));

  return enrollment;
}
