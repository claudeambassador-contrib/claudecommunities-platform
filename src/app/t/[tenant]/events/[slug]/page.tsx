import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Edit,
  FolderOpen,
  MapPin,
  PlayCircle,
  Users,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventAttendance } from "@/components/EventAttendance";
import LessonContent from "@/components/LessonContent";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { timezoneForCity } from "@/lib/cities";
import { getCities } from "@/lib/cities-data";
import { getPrisma } from "@/lib/prisma";
import { stripMarkdown } from "@/lib/strip-markdown";
import { getTenantConfig, ogLocale, siteUrl } from "@/lib/tenant-config";
import EventPageRsvp from "./EventPageRsvp";

export const dynamic = "force-dynamic";

// Map past event slugs to their replay/recap pages.
// When a slug is present here, a "Watch the Replay" CTA is shown at the top
// of the event page.
const EVENT_REPLAYS: Record<string, { href: string; label: string; subtitle: string }> = {
  "claude-community-australia-webinar-april-2026": {
    href: "/webinars/claude-code-webinar-australia",
    label: "Watch the Replay",
    subtitle: "The full webinar recording is now available — featuring all 7 lightning talks.",
  },
};

async function getEvent(param: string) {
  const db = await getPrisma();
  const event = await db.event.findFirst({
    where: { AND: [{ isActive: true }, { OR: [{ slug: param }, { id: param }] }] },
    include: {
      _count: { select: { rsvps: true, resources: true } },
    },
  });
  return event;
}

async function getTimezoneAbbr(date: Date, timeZone: string): Promise<string> {
  const parts = new Intl.DateTimeFormat((await getTenantConfig()).lang, {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return { title: "Event Not Found" };
  }

  const BASE_URL = await siteUrl();
  const title = `${event.title} - Claude Code Community`;
  const description = event.description
    ? stripMarkdown(event.description).slice(0, 160)
    : `Join us for ${event.title} — a Claude Code Community event.`;
  const url = `${BASE_URL}/events/${event.slug || event.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: (await getTenantConfig()).communityName,
      locale: await ogLocale(),
      images: [
        {
          url: event.imageUrl || "/images/claude-code-logo.webp",
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [event.imageUrl || "/images/claude-code-logo.webp"],
    },
  };
}

async function JsonLd({
  event,
}: {
  event: {
    id: string;
    slug: string | null;
    title: string;
    description: string | null;
    location: string | null;
    city: string | null;
    startTime: Date;
    endTime: Date | null;
    isOnline: boolean;
    imageUrl: string | null;
  };
}) {
  const config = await getTenantConfig();
  const BASE_URL = config.siteUrl;
  const eventUrl = `${BASE_URL}/events/${event.slug || event.id}`;
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || `Claude Code Community event: ${event.title}`,
    startDate: event.startTime.toISOString(),
    ...(event.endTime && { endDate: event.endTime.toISOString() }),
    location: event.isOnline
      ? { "@type": "VirtualLocation", url: eventUrl }
      : {
          "@type": "Place",
          name: event.location || event.city || "TBA",
          ...(event.city && {
            address: {
              "@type": "PostalAddress",
              addressLocality: event.city,
              addressCountry: config.countryName,
            },
          }),
        },
    organizer: {
      "@type": "Organization",
      name: config.communityName,
      url: BASE_URL,
    },
    eventAttendanceMode: event.isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    ...(event.imageUrl && { image: event.imageUrl }),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: config.currency,
      availability: "https://schema.org/InStock",
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Find an Event",
        item: `${BASE_URL}/events`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: event.title,
        item: eventUrl,
      },
    ],
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.communityName,
    url: BASE_URL,
    logo: `${BASE_URL}/images/claude-code-logo.webp`,
    sameAs: [],
  };

  const schemas = [eventSchema, breadcrumbSchema, organizationSchema];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          // biome-ignore lint/suspicious/noArrayIndexKey: static fixed-length schema list that never reorders or changes
          key={i}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted JSON-LD built server-side from JSON.stringify of static schema objects (no user HTML)
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large server-rendered event page; branching is inherent to the layout (admin/past/replay/online variants + presentational ternaries), extraction would not meaningfully reduce risk
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [event, user] = await Promise.all([getEvent(slug), getCurrentUserWithPermissions()]);

  if (!event) {
    notFound();
  }

  const isAdmin = user?.permissions.includes("events.edit") ?? false;
  const isPast = event.startTime <= new Date();

  const config = await getTenantConfig();
  const cities = await getCities();
  const tz = event.timezone || timezoneForCity(cities, event.city || "", config.defaultTimezone);
  const tzAbbr = await getTimezoneAbbr(event.startTime, tz);

  const lang = config.lang;

  const formatDate = (date: Date) =>
    date.toLocaleDateString(lang, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });

  const eventTypeLabel = event.isOnline
    ? "Online"
    : event.eventType === "meetup"
      ? "In-person"
      : event.eventType === "workshop"
        ? "Workshop"
        : event.eventType === "conference"
          ? "Conference"
          : event.eventType === "hybrid"
            ? "Hybrid"
            : "Event";

  const replay = event.slug ? EVENT_REPLAYS[event.slug] : null;

  const eventTypeBadgeColor = event.isOnline
    ? "bg-blue-500/20 text-blue-400"
    : event.eventType === "workshop"
      ? "bg-amber-500/20 text-amber-400"
      : event.eventType === "conference"
        ? "bg-rose-500/20 text-rose-400"
        : event.eventType === "hybrid"
          ? "bg-purple-500/20 text-purple-400"
          : "bg-green-500/20 text-green-400";

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <JsonLd event={event} />

      {/* Back link */}
      <div className="pt-[92px] px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <TenantLink
              href="/events"
              className="inline-flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </TenantLink>
            {isAdmin && (
              <TenantLink
                href={`/admin/events?edit=${event.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#2D2926] text-[#A8A29E] hover:text-white border border-white/[0.06] rounded-lg hover:bg-white/5 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Event
              </TenantLink>
            )}
          </div>
        </div>
      </div>

      {/* Event image */}
      <div className="px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#D4836A]/20 to-[#3D3936] aspect-video flex items-center justify-center">
            {event.imageUrl ? (
              <RemoteImage
                src={event.imageUrl}
                alt={event.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <Calendar className="w-16 h-16 text-[#78716C]" />
            )}
            <div className="absolute top-4 left-4">
              <span
                className={`px-3 py-1.5 text-xs font-medium rounded-full ${eventTypeBadgeColor}`}
              >
                {eventTypeLabel}
              </span>
            </div>
            {isPast && (
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 text-[#A8A29E]">
                  Past Event
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event content */}
      <div className="px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {replay && (
            <TenantLink
              href={replay.href}
              className="group block mb-8 rounded-2xl bg-gradient-to-r from-[#D4836A] to-[#C97658] p-5 md:p-6 shadow-[0_8px_32px_rgba(212,131,106,0.3)] hover:shadow-[0_12px_40px_rgba(212,131,106,0.45)] hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-4 md:gap-5">
                <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#1C1917]/15 flex items-center justify-center">
                  <PlayCircle className="w-7 h-7 md:w-8 md:h-8 text-[#1C1917]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#1C1917]/70 mb-1">
                    Now available
                  </div>
                  <div className="text-lg md:text-xl font-semibold text-[#1C1917]">
                    {replay.label}
                  </div>
                  <div className="text-sm text-[#1C1917]/80 mt-0.5">{replay.subtitle}</div>
                </div>
                <ArrowRight className="hidden sm:block flex-shrink-0 w-5 h-5 text-[#1C1917] transition-transform group-hover:translate-x-1" />
              </div>
            </TenantLink>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">{event.title}</h1>

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-[#A8A29E]">
              <Clock className="w-5 h-5 shrink-0 text-[#78716C]" />
              <span>
                {formatDate(event.startTime)} at {formatTime(event.startTime)}
                {event.endTime && ` – ${formatTime(event.endTime)}`}
                {tzAbbr && ` ${tzAbbr}`}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[#A8A29E]">
              {event.isOnline ? (
                <>
                  <Video className="w-5 h-5 shrink-0 text-[#78716C]" />
                  <span>Online Event</span>
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5 shrink-0 text-[#78716C]" />
                  <span>{event.location || event.city || "Location TBA"}</span>
                </>
              )}
            </div>

            <EventAttendance event={event}>
              <div className="flex items-center gap-3 text-[#A8A29E]">
                <Users className="w-5 h-5 shrink-0 text-[#78716C]" />
                <span>
                  {event._count.rsvps} attending
                  {event.maxAttendees && event.maxAttendees > 0 && ` · ${event.maxAttendees} spots`}
                </span>
              </div>
            </EventAttendance>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">About this event</h2>
              <div className="text-[#A8A29E] leading-relaxed">
                <LessonContent content={event.description} />
              </div>
            </div>
          )}

          {/* Resources */}
          {event._count.resources > 0 && (
            <div className="pt-6 border-t border-white/[0.06]">
              <TenantLink
                href={`/events/${event.slug || event.id}/resources`}
                className="group flex items-center gap-3 p-4 rounded-xl bg-[#2D2926] border border-white/[0.06] hover:border-[#D4836A]/40 hover:bg-[#3D3936] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#D4836A]/15 flex items-center justify-center text-[#D4836A]">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium">Resources</div>
                  <div className="text-sm text-[#A8A29E]">
                    {event._count.resources} file{event._count.resources === 1 ? "" : "s"} · sign in
                    to view
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-[#78716C] group-hover:text-white group-hover:translate-x-1 transition-all" />
              </TenantLink>
            </div>
          )}

          {/* RSVP */}
          <div className="pt-6 border-t border-white/[0.06]">
            <EventPageRsvp
              eventId={event.id}
              lumaUrl={event.lumaUrl}
              isPast={isPast}
              rsvpEnabled={event.rsvpEnabled ?? false}
              isAuthenticated={!!user}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
