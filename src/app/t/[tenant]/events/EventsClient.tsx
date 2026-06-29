"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import type { Event } from "@/components/EventDetailModal";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { timezoneForCity } from "@/lib/cities";
import { stripMarkdown } from "@/lib/strip-markdown";

interface EventsClientProps {
  initialEvents: Event[];
}

// Tabnabbing + open-redirect guard: only open if URL is on the luma.com host,
// and always with noopener,noreferrer so the new tab can't reach back via
// window.opener.
function openLuma(lumaUrl: string | null | undefined) {
  if (!lumaUrl) return;
  try {
    const u = new URL(lumaUrl);
    if (
      u.protocol === "https:" &&
      (u.hostname === "luma.com" || u.hostname.endsWith(".luma.com"))
    ) {
      window.open(u.href, "_blank", "noopener,noreferrer");
    }
  } catch {
    /* invalid URL — silently ignore */
  }
}

export default function EventsClient({ initialEvents }: EventsClientProps) {
  const config = useTenantConfig();
  const cityCatalog = useCities();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [filter, setFilter] = useState<string>("all");

  const formatDate = (event: Event) => {
    const tz =
      event.timezone || timezoneForCity(cityCatalog, event.city || "", config.defaultTimezone);
    return new Date(event.startTime).toLocaleDateString(config.lang, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });
  };

  const formatTime = (event: Event) => {
    const tz =
      event.timezone || timezoneForCity(cityCatalog, event.city || "", config.defaultTimezone);
    return new Date(event.startTime).toLocaleTimeString(config.lang, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
  };

  const now = new Date();
  const tabEvents =
    tab === "upcoming"
      ? initialEvents.filter((e) => new Date(e.startTime) > now)
      : initialEvents
          .filter((e) => new Date(e.startTime) <= now)
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const cities = ["all", ...new Set(tabEvents.map((e) => e.city).filter(Boolean))];

  const filteredEvents = filter === "all" ? tabEvents : tabEvents.filter((e) => e.city === filter);

  return (
    <>
      {/* Tabs */}
      <section className="px-6 mb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-1 bg-[#2a2a2a] rounded-lg p-1 w-fit">
            <button
              type="button"
              onClick={() => {
                setTab("upcoming");
                setFilter("all");
              }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "upcoming" ? "bg-[#E07A5F] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("past");
                setFilter("all");
              }}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "past" ? "bg-[#E07A5F] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Past
            </button>
          </div>
        </div>
      </section>

      {/* Filter */}
      <section className="px-6 mb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-400 text-sm">Filter by city:</span>
            {cities.map((city) => (
              <button
                key={city || "all"}
                type="button"
                onClick={() => setFilter(city || "all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === city
                    ? "bg-[#E07A5F] text-white"
                    : "bg-[#2a2a2a] text-gray-400 hover:text-white"
                }`}
              >
                {city === "all" ? "All Cities" : city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-400">
                {tab === "upcoming" ? "No upcoming events" : "No past events"}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {tab === "upcoming"
                  ? "Check back soon for upcoming meetups!"
                  : "Past events will appear here after they've taken place."}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <TenantLink
                  key={event.id}
                  href={`/events/${event.slug || event.id}`}
                  className="bg-[#2a2a2a] rounded-xl overflow-hidden border border-[#333] hover:border-[#E07A5F]/50 transition-colors"
                >
                  {/* Event Image or Placeholder */}
                  <div className="h-40 bg-gradient-to-br from-[#E07A5F]/20 to-[#333] flex items-center justify-center">
                    {event.imageUrl ? (
                      <RemoteImage
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <svg
                        className="w-16 h-16 text-[#E07A5F]/50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="p-5">
                    {/* Date Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 bg-[#E07A5F]/20 text-[#E07A5F] rounded-full text-xs font-medium">
                        {formatDate(event)}
                      </span>
                      {event.isOnline && (
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                          Online
                        </span>
                      )}
                    </div>

                    <h3 className="text-white font-semibold text-lg mb-2">{event.title}</h3>

                    {event.description && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {stripMarkdown(event.description)}
                      </p>
                    )}

                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{formatTime(event)}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      {event.lumaUrl ? (
                        // biome-ignore lint/a11y/useSemanticElements: a real <button> is invalid here because this control is nested inside the card-wide <Link> (an <a>); keep the span with role/tabIndex/onKeyDown for keyboard a11y
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            openLuma(event.lumaUrl);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openLuma(event.lumaUrl);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c96a52] transition-colors font-medium text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          RSVP on Luma
                        </span>
                      ) : event.rsvpEnabled ? (
                        <span className="w-full block text-center py-2.5 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c96a52] transition-colors font-medium">
                          RSVP
                        </span>
                      ) : (
                        <span className="w-full block text-center py-2.5 text-sm text-[#78716C] italic">
                          RSVP coming later
                        </span>
                      )}
                    </div>
                  </div>
                </TenantLink>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
