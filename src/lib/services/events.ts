/**
 * Events service — CRUD, RSVP toggle, RSVP stats, URL host validation.
 *
 * URL host pinning lives here so both API routes and MCP tools enforce the
 * same allow-lists; MCP previously skipped this.
 */

import { timezoneForCity } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getPrisma } from "@/lib/prisma";
import { getEventReminderEmailHtml, sendEmail } from "@/lib/resend";
import { CACHE_TAGS, revalidatePathSafe, revalidateTagSafe } from "@/lib/revalidate";
import { isStorageUrl } from "@/lib/storage";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";
import { buildDateSlug } from "./_slug";
import { notifyLumaWaitlist } from "./eventLumaInterest";
import { invalidateForEvent } from "./slideRenderInvalidation";

export type RsvpStatus = "going" | "interested" | "not_going";

// Refresh the cached public event views after a write. `/events` and the
// per-city pages are ISR; the `events` tag covers the upcoming-event count
// widget on the community page.
function revalidateEventViews() {
  revalidatePathSafe("/events");
  revalidatePathSafe("/cities/[slug]", "page");
  revalidateTagSafe(CACHE_TAGS.events);
}

const ALLOWED_MEETING_HOSTS = [
  "zoom.us",
  "us02web.zoom.us",
  "us04web.zoom.us",
  "us05web.zoom.us",
  "us06web.zoom.us",
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com",
  "lu.ma",
  "luma.com",
];

export function isAllowedMeetingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_MEETING_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function isAllowedLumaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedImageUrl(url: string): boolean {
  if (isStorageUrl(url)) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return u.hostname === "images.lumacdn.com";
  } catch {
    return false;
  }
}

export interface EventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  city?: string | null;
  timezone?: string | null;
  eventType?: string;
  startTime: string;
  endTime?: string | null;
  maxAttendees?: number | null;
  isOnline?: boolean;
  meetingUrl?: string | null;
  lumaUrl?: string | null;
  imageUrl?: string | null;
  rsvpEnabled?: boolean;
  isActive?: boolean;
  headerText?: string | null;
  footerText?: string | null;
  feedbackUrl?: string | null;
}

// `validCities` is the tenant's allowed city-name set (incl. "Online"), or
// `null` to skip city validation entirely — passed as null when the tenant has
// no cities yet so new tenants/tests aren't blocked.
function validateInput(input: EventInput, validCities: Set<string> | null): void {
  if (!input.title || input.title.length < 1 || input.title.length > 200) {
    throw new ServiceError("bad_request", "title required (1-200 chars)");
  }
  if (input.city && validCities && !validCities.has(input.city)) {
    throw new ServiceError("bad_request", `Invalid city: ${input.city}`);
  }
  if (input.timezone && !/^[A-Za-z_+\-/0-9]+$/.test(input.timezone)) {
    throw new ServiceError("bad_request", "Invalid timezone");
  }
  if (input.meetingUrl && !isAllowedMeetingUrl(input.meetingUrl)) {
    throw new ServiceError("bad_request", "meetingUrl host not allowed");
  }
  if (input.lumaUrl && !isAllowedLumaUrl(input.lumaUrl)) {
    throw new ServiceError("bad_request", "External ticket URL must be a valid https:// URL");
  }
  if (input.imageUrl && !isAllowedImageUrl(input.imageUrl)) {
    throw new ServiceError("bad_request", "imageUrl host not allowed");
  }
}

// The current tenant's allowed city-name set (incl. "Online"), or `null` when
// the tenant has no cities yet (skips city validation — see validateInput).
async function tenantCityNames(): Promise<Set<string> | null> {
  const cities = await getCities();
  if (cities.length === 0) return null;
  return new Set<string>(["Online", ...cities.map((c) => c.name)]);
}

export async function listEvents(options: { includeInactive?: boolean } = {}) {
  const db = await getPrisma();
  const events = await db.event.findMany({
    where: options.includeInactive ? undefined : { isActive: true },
    orderBy: { startTime: "asc" },
    include: { _count: { select: { rsvps: true } } },
  });
  return events.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    location: event.location,
    city: event.city,
    timezone: event.timezone,
    eventType: event.eventType,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime?.toISOString() || null,
    isOnline: event.isOnline,
    meetingUrl: event.meetingUrl,
    lumaUrl: event.lumaUrl,
    imageUrl: event.imageUrl,
    maxAttendees: event.maxAttendees,
    rsvpEnabled: event.rsvpEnabled,
    isActive: event.isActive,
    headerText: event.headerText,
    footerText: event.footerText,
    feedbackUrl: event.feedbackUrl,
    claudienceSessionCode: event.claudienceSessionCode,
    claudienceSessionPassword: event.claudienceSessionPassword,
    claudienceSessionUrl: event.claudienceSessionUrl,
    claudienceSurveyId: event.claudienceSurveyId,
    claudienceSurveyUrl: event.claudienceSurveyUrl,
    claudienceNotificationEmail: event.claudienceNotificationEmail,
    _count: { rsvps: event._count.rsvps },
  }));
}

/** Lean projection of active events for the public sitemap. */
export async function listEventSitemapEntries() {
  const db = await getPrisma();
  return db.event.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, updatedAt: true },
    orderBy: { startTime: "asc" },
  });
}

export async function getEvent(id: string, options: { includeInactive?: boolean } = {}) {
  const db = await getPrisma();
  const event = await db.event.findUnique({
    where: { id },
    include: { _count: { select: { rsvps: true } } },
  });
  if (!event) throw new ServiceError("not_found", "Event not found");
  if (!options.includeInactive && !event.isActive) {
    throw new ServiceError("not_found", "Event not found");
  }
  return {
    ...event,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime?.toISOString() || null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export async function setEventActive(actor: ActorLike, id: string, isActive: boolean) {
  ensurePermission(actor, "events.edit");
  const db = await getPrisma();
  const event = await db.event.update({ where: { id }, data: { isActive } });
  revalidateEventViews();
  return { id: event.id, isActive: event.isActive, success: true };
}

export async function createEvent(actor: ActorLike, input: EventInput) {
  ensurePermission(actor, "events.edit");
  const db = await getPrisma();
  validateInput(input, await tenantCityNames());

  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) {
    throw new ServiceError("bad_request", "Invalid startTime");
  }
  const slug = await buildDateSlug("event", input.title, startTime);

  const event = await db.event.create({
    data: {
      title: input.title,
      slug,
      description: input.description || null,
      location: input.location || null,
      city: input.city || null,
      timezone: input.timezone || null,
      eventType: input.eventType || "meetup",
      startTime,
      endTime: input.endTime ? new Date(input.endTime) : null,
      maxAttendees: input.maxAttendees ?? null,
      isOnline: input.isOnline ?? false,
      meetingUrl: input.meetingUrl || null,
      lumaUrl: input.lumaUrl || null,
      imageUrl: input.imageUrl || null,
      rsvpEnabled: input.rsvpEnabled ?? false,
      isActive: input.isActive ?? true,
      headerText: input.headerText || null,
      footerText: input.footerText || null,
      feedbackUrl: input.feedbackUrl || null,
    },
  });

  revalidateEventViews();
  return { id: event.id, slug: event.slug, title: event.title, success: true };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat per-field guard list with field-specific transforms; a table-driven rewrite would obscure the distinct null/Date coercions per field.
function buildEventUpdateData(input: Partial<EventInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.location !== undefined) data.location = input.location || null;
  if (input.city !== undefined) data.city = input.city || null;
  if (input.timezone !== undefined) data.timezone = input.timezone || null;
  if (input.eventType !== undefined) data.eventType = input.eventType;
  if (input.startTime !== undefined) data.startTime = new Date(input.startTime);
  if (input.endTime !== undefined) data.endTime = input.endTime ? new Date(input.endTime) : null;
  if (input.maxAttendees !== undefined) data.maxAttendees = input.maxAttendees ?? null;
  if (input.isOnline !== undefined) data.isOnline = input.isOnline;
  if (input.meetingUrl !== undefined) data.meetingUrl = input.meetingUrl || null;
  if (input.lumaUrl !== undefined) data.lumaUrl = input.lumaUrl || null;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl || null;
  if (input.rsvpEnabled !== undefined) data.rsvpEnabled = input.rsvpEnabled;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.headerText !== undefined) data.headerText = input.headerText || null;
  if (input.footerText !== undefined) data.footerText = input.footerText || null;
  if (input.feedbackUrl !== undefined) data.feedbackUrl = input.feedbackUrl || null;
  return data;
}

export async function updateEvent(actor: ActorLike, id: string, input: Partial<EventInput>) {
  ensurePermission(actor, "events.edit");
  const db = await getPrisma();
  // Validate fields that are present.
  validateInput(
    {
      ...input,
      title: input.title ?? "placeholder",
      startTime: input.startTime ?? new Date().toISOString(),
    },
    await tenantCityNames(),
  );

  const data = buildEventUpdateData(input);

  // Capture the prior lumaUrl so we can detect a null→set transition and
  // fan out the waitlist notifications below.
  let priorLumaUrl: string | null = null;
  if (input.lumaUrl !== undefined) {
    const before = await db.event.findUnique({
      where: { id },
      select: { lumaUrl: true },
    });
    priorLumaUrl = before?.lumaUrl ?? null;
  }

  const event = await db.event.update({ where: { id }, data });

  if (input.lumaUrl !== undefined && !priorLumaUrl && event.lumaUrl) {
    // Fire-and-forget: matches the rsvpToEvent email pattern; the admin save
    // should not block on a potentially large fan-out.
    notifyLumaWaitlist(event.id).catch((err) => {
      console.error("Failed to notify Luma waitlist for event", event.id, err);
    });
  }

  revalidateEventViews();
  return { id: event.id, slug: event.slug, title: event.title, success: true };
}

export async function deleteEvent(actor: ActorLike, id: string) {
  ensurePermission(actor, "events.delete");
  const db = await getPrisma();
  await invalidateForEvent(id);
  await db.event.delete({ where: { id } });
  revalidateEventViews();
  return { success: true };
}

export async function getRsvpStats(eventId: string, viewer?: ActorLike | null) {
  const db = await getPrisma();
  const rsvps = await db.eventRSVP.findMany({
    where: { eventId },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });

  let userRsvp: string | null = null;
  if (viewer) {
    const existing = await db.eventRSVP.findFirst({
      where: { userId: viewer.id, eventId },
    });
    userRsvp = existing?.status || null;
  }

  const going = rsvps.filter((r) => r.status === "going");
  const interested = rsvps.filter((r) => r.status === "interested");

  return {
    going: going.map((r) => ({ id: r.user.id, name: r.user.name, image: r.user.image })),
    interested: interested.map((r) => ({ id: r.user.id, name: r.user.name, image: r.user.image })),
    userRsvp,
    isAuthenticated: !!viewer,
    counts: {
      going: going.length,
      interested: interested.length,
      total: rsvps.length,
    },
  };
}

export async function rsvpToEvent(
  actor: ActorLike & { email?: string | null; name?: string | null },
  eventId: string,
  status: RsvpStatus,
) {
  const db = await getPrisma();
  if (!["going", "interested", "not_going"].includes(status)) {
    throw new ServiceError(
      "bad_request",
      "Invalid status. Must be 'going', 'interested', or 'not_going'",
    );
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startTime: true,
      location: true,
      maxAttendees: true,
      timezone: true,
      city: true,
      lumaUrl: true,
      rsvpEnabled: true,
    },
  });
  if (!event) throw new ServiceError("not_found", "Event not found");

  if (!event.rsvpEnabled || event.lumaUrl) {
    throw new ServiceError("bad_request", "Internal RSVP is not enabled for this event");
  }

  if (status === "going" && event.maxAttendees) {
    const currentGoing = await db.eventRSVP.count({
      where: { eventId, status: "going", userId: { not: actor.id } },
    });
    if (currentGoing >= event.maxAttendees) {
      throw new ServiceError("bad_request", "Event is at maximum capacity");
    }
  }

  if (status === "not_going") {
    await db.eventRSVP.deleteMany({ where: { eventId, userId: actor.id } });
  } else {
    await db.eventRSVP.upsert({
      where: {
        tenantId_userId_eventId: { tenantId: await getTenantId(), userId: actor.id, eventId },
      },
      update: { status },
      create: { userId: actor.id, eventId, status },
    });

    if (status === "going" && actor.email) {
      const config = await getTenantConfig();
      const { lang } = config;
      const cities = await getCities();
      const eventTz =
        event.timezone || timezoneForCity(cities, event.city || "", config.defaultTimezone);
      const startDate = new Date(event.startTime);
      const formatted = startDate.toLocaleDateString(lang, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: eventTz,
      });
      const tzAbbr =
        new Intl.DateTimeFormat(lang, { timeZone: eventTz, timeZoneName: "short" })
          .formatToParts(startDate)
          .find((p) => p.type === "timeZoneName")?.value || eventTz;
      const html = getEventReminderEmailHtml(
        actor.name || "there",
        event.title,
        `${formatted} (${tzAbbr})`,
        event.location || "TBA",
        event.id,
        config,
      );
      sendEmail({
        to: actor.email,
        subject: `You're going to: ${event.title}`,
        html,
      }).catch((e) => console.error("Failed to send RSVP confirmation email:", e));
    }
  }

  const counts = await db.eventRSVP.groupBy({
    by: ["status"],
    where: { eventId },
    _count: true,
  });
  const goingCount = counts.find((c) => c.status === "going")?._count || 0;
  const interestedCount = counts.find((c) => c.status === "interested")?._count || 0;

  return {
    success: true,
    status: status === "not_going" ? null : status,
    counts: { going: goingCount, interested: interestedCount },
  };
}

export async function deleteRsvp(actor: ActorLike, eventId: string) {
  const db = await getPrisma();
  await db.eventRSVP.deleteMany({ where: { eventId, userId: actor.id } });
  return { success: true };
}
