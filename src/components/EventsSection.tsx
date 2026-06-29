"use client";

import { ArrowRight, Clock, MapPin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { timezoneForCity } from "@/lib/cities";
import { EventAttendance } from "./EventAttendance";

interface Event {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  timezone: string | null;
  eventType: string;
  isOnline: boolean;
  startTime: string;
  imageUrl: string | null;
  maxAttendees: number | null;
  lumaUrl: string | null;
  rsvpEnabled?: boolean;
  _count?: { rsvps: number };
}

const EVENT_FALLBACK_IMAGE = "/images/event-fallback.jpg";

export default function EventsSection() {
  const config = useTenantConfig();
  const cities = useCities();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchEvents = () => {
    setLoading(true);
    setError(false);
    fetch("/api/events")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch events");
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const upcoming = data.filter((e: Event) => new Date(e.startTime) > new Date()).slice(0, 6);
        setEvents(upcoming);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial fetch; fetchEvents is recreated each render so including it would refetch on every render
  useEffect(() => {
    fetchEvents();
  }, []);

  const formatDate = (dateString: string, tz: string) => {
    const { lang } = config;
    const date = new Date(dateString);
    return {
      day: Number(new Intl.DateTimeFormat(lang, { day: "numeric", timeZone: tz }).format(date)),
      month: date.toLocaleDateString(lang, { month: "short", timeZone: tz }).toUpperCase(),
      weekday: date.toLocaleDateString(lang, { weekday: "short", timeZone: tz }),
      time: date
        .toLocaleTimeString(lang, {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        })
        .toUpperCase(),
    };
  };

  const getEventTypeBadge = (eventType: string, isOnline: boolean) => {
    if (isOnline) {
      return { label: "Online", color: "bg-blue-600 text-white border-blue-700" };
    }
    switch (eventType) {
      case "meetup":
        return { label: "In-person", color: "bg-green-600 text-white border-green-700" };
      case "hybrid":
        return { label: "Hybrid", color: "bg-purple-600 text-white border-purple-700" };
      case "workshop":
        return { label: "Workshop", color: "bg-amber-600 text-white border-amber-700" };
      case "conference":
        return { label: "Conference", color: "bg-rose-600 text-white border-rose-700" };
      case "hackathon":
        return { label: "Hackathon", color: "bg-emerald-600 text-white border-emerald-700" };
      case "social":
        return { label: "Social", color: "bg-blue-600 text-white border-blue-700" };
      default:
        return { label: "Event", color: "bg-[#D4836A] text-white border-[#B66B54]" };
    }
  };

  if (loading) {
    return (
      <section id="events" className="py-24 px-6 bg-[#292524]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="events" className="py-24 px-6 bg-[#292524]">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">Upcoming Claude Code Meetups</h2>
          <p className="text-[#A8A29E] text-lg mb-6">Failed to load events</p>
          <button
            type="button"
            onClick={fetchEvents}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section id="events" className="py-24 px-6 bg-[#292524]">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">Upcoming Claude Code Meetups</h2>
          <p className="text-[#A8A29E] text-lg mb-8">
            No upcoming events scheduled yet. Check back soon!
          </p>
          <TenantLink
            href="/events"
            className="inline-flex items-center gap-2 text-[#D4836A] font-semibold hover:gap-3 transition-all"
          >
            View All Events <ArrowRight className="w-4 h-4" />
          </TenantLink>
        </div>
      </section>
    );
  }

  return (
    <section id="events" className="py-24 px-6 bg-[#292524]">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold mb-2">
              Upcoming Claude Code Meetups
            </h2>
            <p className="text-[#A8A29E] text-lg">Join a meetup and connect with the community</p>
          </div>
          <TenantLink
            href="/events"
            className="inline-flex items-center gap-2 text-[#D4836A] font-semibold hover:gap-3 transition-all"
          >
            View All Events <ArrowRight className="w-4 h-4" />
          </TenantLink>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const tz =
              event.timezone || timezoneForCity(cities, event.city || "", config.defaultTimezone);
            const { day, month, weekday, time } = formatDate(event.startTime, tz);
            return (
              <TenantLink
                key={event.id}
                href={`/events/${event.slug || event.id}`}
                className="group bg-[#1C1917] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-[#D4836A]/30 transition-all hover:-translate-y-1"
              >
                {/* Event Image */}
                <div className="relative h-40 overflow-hidden">
                  <RemoteImage
                    src={event.imageUrl || EVENT_FALLBACK_IMAGE}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Date overlay */}
                  <div className="absolute bottom-3 left-3 bg-[#1C1917]/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                    <span className="block text-lg font-bold text-white leading-none">{day}</span>
                    <span className="block text-[10px] text-[#D4836A] font-semibold">{month}</span>
                  </div>
                  {(() => {
                    const badge = getEventTypeBadge(event.eventType, event.isOnline);
                    return (
                      <span
                        className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-[#A8A29E] mb-2">
                    <Clock className="w-3 h-3" />
                    <span>
                      {weekday} {time}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#D4836A] transition-colors line-clamp-2">
                    {event.title}
                  </h3>

                  {event.description && (
                    <p className="text-[#A8A29E] text-sm mb-4 line-clamp-2">{event.description}</p>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm text-[#78716C]">
                    {event.city && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.city}
                      </span>
                    )}
                    <EventAttendance event={event}>
                      {(event._count?.rsvps ?? 0) > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {event._count?.rsvps} going
                        </span>
                      )}
                    </EventAttendance>
                  </div>
                </div>
              </TenantLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
