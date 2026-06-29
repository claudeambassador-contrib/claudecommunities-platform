/**
 * Luma-interest waitlist — lets a signed-in user ask to be notified once an
 * admin pastes the event's Luma URL. On that null→set transition the
 * `events.ts` service calls `notifyLumaWaitlist` here, which fans out one
 * in-app notification + one email per waiting user and stamps `notifiedAt`
 * so re-saves don't re-fire.
 */

import { timezoneForCity } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getPrisma } from "@/lib/prisma";
import { getLumaLinkReadyEmailHtml, sendEmail } from "@/lib/resend";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";

export async function registerLumaInterest(actor: ActorLike, eventId: string) {
  const db = await getPrisma();
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { isBanned: true },
  });
  if (!user) throw new ServiceError("unauthenticated", "User not found");
  if (user.isBanned) throw new ServiceError("forbidden", "Account is banned");

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, lumaUrl: true, isActive: true, startTime: true },
  });
  if (!event?.isActive) throw new ServiceError("not_found", "Event not found");
  if (event.lumaUrl) {
    throw new ServiceError("bad_request", "Luma link is already available — RSVP on Luma instead");
  }
  if (event.startTime <= new Date()) {
    throw new ServiceError("bad_request", "Event has already started");
  }

  await db.eventLumaInterest.upsert({
    where: {
      tenantId_userId_eventId: { tenantId: await getTenantId(), userId: actor.id, eventId },
    },
    update: {},
    create: { userId: actor.id, eventId },
  });
  return { success: true, registered: true };
}

export async function unregisterLumaInterest(actor: ActorLike, eventId: string) {
  const db = await getPrisma();
  await db.eventLumaInterest.deleteMany({
    where: { eventId, userId: actor.id },
  });
  return { success: true, registered: false };
}

export async function getLumaInterestStatus(eventId: string, viewer?: ActorLike | null) {
  const db = await getPrisma();
  const [count, mine] = await Promise.all([
    db.eventLumaInterest.count({ where: { eventId } }),
    viewer
      ? db.eventLumaInterest.findFirst({
          where: { userId: viewer.id, eventId },
        })
      : Promise.resolve(null),
  ]);
  return {
    registered: !!mine,
    count,
    isAuthenticated: !!viewer,
  };
}

export async function getLumaWaitlistCount(eventId: string): Promise<number> {
  const db = await getPrisma();
  return db.eventLumaInterest.count({ where: { eventId } });
}

/**
 * List the signed-in user's active Luma waitlist subscriptions — events they
 * asked to be notified about that don't have a Luma URL yet and haven't
 * already started.
 */
export async function listLumaInterestsForUser(actor: ActorLike) {
  const db = await getPrisma();
  const rows = await db.eventLumaInterest.findMany({
    where: {
      userId: actor.id,
      event: { isActive: true, lumaUrl: null, startTime: { gt: new Date() } },
    },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          startTime: true,
          timezone: true,
          city: true,
        },
      },
    },
    orderBy: { event: { startTime: "asc" } },
  });
  return rows.map((row) => ({
    eventId: row.eventId,
    slug: row.event.slug,
    title: row.event.title,
    startTime: row.event.startTime.toISOString(),
    timezone: row.event.timezone,
    city: row.event.city,
  }));
}

/**
 * Fan out the "Luma link is ready" notification + email to every waiting user
 * who hasn't been notified yet. Safe to call multiple times — `notifiedAt`
 * gates each row.
 */
export async function notifyLumaWaitlist(eventId: string): Promise<{
  notified: number;
  failedEmails: number;
}> {
  const db = await getPrisma();
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startTime: true,
      timezone: true,
      city: true,
      lumaUrl: true,
    },
  });
  if (!event?.lumaUrl) {
    return { notified: 0, failedEmails: 0 };
  }

  const pending = await db.eventLumaInterest.findMany({
    where: { eventId, notifiedAt: null },
    include: { user: { select: { id: true, name: true, email: true, isBanned: true } } },
  });
  if (pending.length === 0) return { notified: 0, failedEmails: 0 };

  const config = await getTenantConfig();
  const { lang } = config;
  const cities = await getCities();
  const eventTz =
    event.timezone || timezoneForCity(cities, event.city || "", config.defaultTimezone);
  const startDate = new Date(event.startTime);
  const formattedDate = startDate.toLocaleDateString(lang, {
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
  const fullDate = `${formattedDate} (${tzAbbr})`;
  const subject = `Registration is open: ${event.title}`;
  const inAppMessage =
    "The Luma link is now live — open this notification to RSVP. You'll still need to register on Luma to secure your spot.";
  const eventLink = `/events/${event.id}`;

  let failedEmails = 0;
  for (const row of pending) {
    if (row.user.isBanned) {
      await db.eventLumaInterest.update({
        where: { id: row.id },
        data: { notifiedAt: new Date() },
      });
      continue;
    }

    try {
      await db.notification.create({
        data: {
          userId: row.user.id,
          type: "event_luma_ready",
          title: subject,
          message: inAppMessage,
          link: eventLink,
        },
      });
    } catch (err) {
      console.error("notifyLumaWaitlist: failed to create notification", err);
    }

    if (row.user.email) {
      try {
        const html = getLumaLinkReadyEmailHtml(
          row.user.name || "there",
          event.title,
          fullDate,
          event.lumaUrl,
          event.id,
          config,
        );
        const result = await sendEmail({ to: row.user.email, subject, html });
        if (!result.success) failedEmails++;
      } catch (err) {
        failedEmails++;
        console.error("notifyLumaWaitlist: failed to send email", err);
      }
    }

    await db.eventLumaInterest.update({
      where: { id: row.id },
      data: { notifiedAt: new Date() },
    });
  }

  return { notified: pending.length, failedEmails };
}
