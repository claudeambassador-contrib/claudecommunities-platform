/**
 * Scheduled courses (workshops/bootcamps/webinars) — CRUD with slug.
 */
import { getPrisma } from "@/lib/prisma";
import { revalidatePathSafe } from "@/lib/revalidate";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";
import { buildDateSlug } from "./_slug";

export interface ScheduledCourseInput {
  title: string;
  description?: string | null;
  location?: string | null;
  city?: string | null;
  timezone?: string | null;
  startTime: string;
  endTime?: string | null;
  isOnline?: boolean;
  meetingUrl?: string | null;
  imageUrl?: string | null;
  registrationUrl?: string | null;
  courseType?: string;
  isPublished?: boolean;
  price?: string | null;
  instructor?: string | null;
  maxAttendees?: number | string | null;
}

function parseMaxAttendees(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return n > 0 ? n : null;
}

export async function listPublished({ upcoming = false }: { upcoming?: boolean } = {}) {
  const db = await getPrisma();
  const where: { isPublished: boolean; startTime?: { gte: Date } } = { isPublished: true };
  if (upcoming) where.startTime = { gte: new Date() };

  const courses = await db.scheduledCourse.findMany({
    where,
    orderBy: { startTime: "asc" },
  });
  return courses.map((c) => ({
    ...c,
    startTime: c.startTime.toISOString(),
    endTime: c.endTime?.toISOString() || null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function getById(idOrSlug: string) {
  const db = await getPrisma();
  const course = await db.scheduledCourse.findFirst({
    where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
  });
  if (!course) throw new ServiceError("not_found", "Scheduled course not found");
  return {
    ...course,
    startTime: course.startTime.toISOString(),
    endTime: course.endTime?.toISOString() || null,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

export async function create(actor: ActorLike, input: ScheduledCourseInput) {
  const db = await getPrisma();
  ensurePermission(actor, "courses.edit");
  if (!input.title) throw new ServiceError("bad_request", "title required");
  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) {
    throw new ServiceError("bad_request", "Invalid startTime");
  }
  const slug = await buildDateSlug("scheduledCourse", input.title, startTime);

  const course = await db.scheduledCourse.create({
    data: {
      title: input.title,
      slug,
      description: input.description || null,
      location: input.location || null,
      city: input.city || null,
      timezone: input.timezone || null,
      startTime,
      endTime: input.endTime ? new Date(input.endTime) : null,
      isOnline: input.isOnline || false,
      meetingUrl: input.meetingUrl || null,
      imageUrl: input.imageUrl || null,
      registrationUrl: input.registrationUrl || null,
      courseType: input.courseType || "workshop",
      isPublished: input.isPublished || false,
      price: input.price || null,
      instructor: input.instructor || null,
      maxAttendees: parseMaxAttendees(input.maxAttendees),
    },
  });

  revalidatePathSafe("/courses");
  return { id: course.id, slug: course.slug, title: course.title, success: true };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the field-by-field update/validation logic would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
export async function update(actor: ActorLike, id: string, input: Partial<ScheduledCourseInput>) {
  const db = await getPrisma();
  ensurePermission(actor, "courses.edit");
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.location !== undefined) data.location = input.location || null;
  if (input.city !== undefined) data.city = input.city || null;
  if (input.timezone !== undefined) data.timezone = input.timezone || null;
  if (input.startTime !== undefined) data.startTime = new Date(input.startTime);
  if (input.endTime !== undefined) data.endTime = input.endTime ? new Date(input.endTime) : null;
  if (input.isOnline !== undefined) data.isOnline = input.isOnline;
  if (input.meetingUrl !== undefined) data.meetingUrl = input.meetingUrl || null;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl || null;
  if (input.registrationUrl !== undefined) data.registrationUrl = input.registrationUrl || null;
  if (input.courseType !== undefined) data.courseType = input.courseType;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;
  if (input.price !== undefined) data.price = input.price || null;
  if (input.instructor !== undefined) data.instructor = input.instructor || null;
  if (input.maxAttendees !== undefined) data.maxAttendees = parseMaxAttendees(input.maxAttendees);

  const course = await db.scheduledCourse.update({ where: { id }, data });
  revalidatePathSafe("/courses");
  return { id: course.id, slug: course.slug, title: course.title, success: true };
}

export async function remove(actor: ActorLike, id: string) {
  const db = await getPrisma();
  ensurePermission(actor, "courses.delete");
  await db.scheduledCourse.delete({ where: { id } });
  revalidatePathSafe("/courses");
  return { success: true };
}
