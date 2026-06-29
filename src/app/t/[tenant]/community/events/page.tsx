export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import EventsClient from "./EventsClient";

async function getEvents() {
  const db = await getPrisma();
  const events = await db.event.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { rsvps: true } },
      rsvps: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
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
    maxAttendees: event.maxAttendees,
    lumaUrl: event.lumaUrl,
    isOnline: event.isOnline,
    meetingUrl: event.meetingUrl,
    imageUrl: event.imageUrl,
    createdAt: event.createdAt.toISOString(),
    _count: {
      rsvps: event._count.rsvps,
    },
    rsvpData: {
      going: event.rsvps
        .filter((r) => r.status === "going")
        .map((r) => ({
          id: r.user.id,
          name: r.user.name,
          image: r.user.image,
        })),
      interested: event.rsvps
        .filter((r) => r.status === "interested")
        .map((r) => ({
          id: r.user.id,
          name: r.user.name,
          image: r.user.image,
        })),
      userRsvp: null as string | null,
      counts: {
        going: event.rsvps.filter((r) => r.status === "going").length,
        interested: event.rsvps.filter((r) => r.status === "interested").length,
        total: event.rsvps.length,
      },
    },
  }));
}

export default async function EventsPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const events = await getEvents();

  // Add user's RSVP status to each event
  const eventsWithUserRsvp = events.map((event) => ({
    ...event,
    rsvpData: {
      ...event.rsvpData,
      userRsvp: user
        ? event.rsvpData.going.find((u) => u.id === user.id)
          ? "going"
          : event.rsvpData.interested.find((u) => u.id === user.id)
            ? "interested"
            : null
        : null,
    },
  }));

  const isAdmin = user?.permissions.includes("events.edit") ?? false;

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Events</h1>
          <p className="text-[#A8A29E]">Discover and join community events</p>
        </div>

        <EventsClient
          initialEvents={eventsWithUserRsvp}
          currentUserId={user?.id}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
