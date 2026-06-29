"use client";

import {
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  LayoutGrid,
  Loader2,
  MapPin,
  Plus,
  Star,
  Users,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { EventAttendance } from "@/components/EventAttendance";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { type City, timezoneForCity } from "@/lib/cities";

interface Event {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  timezone: string | null;
  eventType: string;
  startTime: string;
  endTime: string | null;
  maxAttendees: number | null;
  lumaUrl: string | null;
  rsvpEnabled?: boolean;
  isOnline: boolean;
  meetingUrl: string | null;
  imageUrl: string | null;
  createdAt: string;
  _count: {
    rsvps: number;
  };
  rsvpData?: {
    going: { id: string; name: string | null; image: string | null }[];
    interested: { id: string; name: string | null; image: string | null }[];
    userRsvp: string | null;
    counts: { going: number; interested: number; total: number };
  };
}

interface EventsClientProps {
  initialEvents: Event[];
  currentUserId?: string;
  isAdmin?: boolean;
}

type TabType = "upcoming" | "past" | "my-rsvps";
type ViewType = "grid" | "calendar";

function getEventTypeBadge(eventType: string, isOnline: boolean) {
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
    default:
      return { label: "Event", color: "bg-[#D4836A] text-white border-[#B66B54]" };
  }
}

function formatEventDate(startTime: string, tz: string) {
  const date = new Date(startTime);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(date);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: Number(g("day")),
    month: g("month"),
    weekday: g("weekday"),
    time: `${g("hour")}:${g("minute")} ${g("dayPeriod")}`.trim(),
    full: date.toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

function getEventTz(event: Event, cities: City[], fallbackTz: string): string {
  return event.timezone || timezoneForCity(cities, event.city || "", fallbackTz);
}

function getCountdown(startTime: string) {
  const now = new Date();
  const eventDate = new Date(startTime);
  const diff = eventDate.getTime() - now.getTime();

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 7) return null;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function AttendeeAvatars({
  attendees,
  max = 5,
}: {
  attendees: { id: string; name: string | null; image: string | null }[];
  max?: number;
}) {
  const displayed = attendees.slice(0, max);
  const remaining = attendees.length - max;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displayed.map((attendee, idx) => (
          <div
            key={attendee.id}
            className="w-7 h-7 rounded-full border-2 border-[#2D2926] bg-[#3D3936] overflow-hidden"
            style={{ zIndex: max - idx }}
            title={attendee.name || "Member"}
          >
            {attendee.image ? (
              <Image
                src={attendee.image}
                alt={attendee.name || "Member"}
                width={28}
                height={28}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#A8A29E]">
                {attendee.name?.charAt(0) || "?"}
              </div>
            )}
          </div>
        ))}
      </div>
      {remaining > 0 && <span className="ml-2 text-xs text-[#78716C]">+{remaining} more</span>}
    </div>
  );
}

function RSVPButton({
  eventId,
  userRsvp,
  onRsvpChange,
}: {
  eventId: string;
  userRsvp: string | null;
  onRsvpChange: (status: string | null) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleRsvp = async (status: string) => {
    setIsLoading(true);
    setShowDropdown(false);

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const data = await res.json();
        onRsvpChange(data.status);
      }
    } catch (error) {
      console.error("Failed to update RSVP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    if (isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }

    switch (userRsvp) {
      case "going":
        return (
          <>
            <Check className="w-4 h-4" />
            <span>Going</span>
          </>
        );
      case "interested":
        return (
          <>
            <Star className="w-4 h-4" />
            <span>Interested</span>
          </>
        );
      default:
        return <span>RSVP</span>;
    }
  };

  const getButtonStyle = () => {
    switch (userRsvp) {
      case "going":
        return "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30";
      case "interested":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30";
      default:
        return "bg-[#D4836A] text-white hover:bg-[#C4735A]";
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier only; wraps independently-focusable controls
    // biome-ignore lint/a11y/useKeyWithClickEvents: only stops click bubbling to the parent card Link; inner controls handle their own keyboard activation
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${getButtonStyle()}`}
      >
        {getButtonContent()}
      </button>

      {showDropdown && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowDropdown(false);
            }}
          />
          <div className="absolute right-0 mt-2 w-40 bg-[#2D2926] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
            <button
              type="button"
              onClick={() => handleRsvp("going")}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 ${userRsvp === "going" ? "text-green-400" : "text-[#E7E5E4]"}`}
            >
              <Check className="w-4 h-4" />
              Going
            </button>
            <button
              type="button"
              onClick={() => handleRsvp("interested")}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 ${userRsvp === "interested" ? "text-amber-400" : "text-[#E7E5E4]"}`}
            >
              <Star className="w-4 h-4" />
              Interested
            </button>
            {userRsvp && (
              <button
                type="button"
                onClick={() => handleRsvp("not_going")}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-red-400 hover:bg-white/5 border-t border-white/5"
              >
                <X className="w-4 h-4" />
                Not Going
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EventCard({ event, currentUserId }: { event: Event; currentUserId?: string }) {
  const cities = useCities();
  const { defaultTimezone } = useTenantConfig();
  const [rsvpData, setRsvpData] = useState(event.rsvpData);
  const [userRsvp, setUserRsvp] = useState(event.rsvpData?.userRsvp || null);

  const dateInfo = formatEventDate(event.startTime, getEventTz(event, cities, defaultTimezone));
  const countdown = getCountdown(event.startTime);
  const badge = getEventTypeBadge(event.eventType, event.isOnline);
  const isPast = new Date(event.startTime) < new Date();
  const attendees = rsvpData?.going || [];
  const goingCount = rsvpData?.counts?.going || event._count.rsvps;

  useEffect(() => {
    // Fetch RSVP data for this event
    fetch(`/api/events/${event.id}/rsvp`)
      .then((res) => res.json())
      .then((data) => {
        setRsvpData(data);
        setUserRsvp(data.userRsvp);
      })
      .catch(console.error);
  }, [event.id]);

  const handleRsvpChange = (newStatus: string | null) => {
    setUserRsvp(newStatus);
    // Refetch RSVP data to update counts
    fetch(`/api/events/${event.id}/rsvp`)
      .then((res) => res.json())
      .then((data) => setRsvpData(data))
      .catch(console.error);
  };

  const eventHref = `/events/${event.slug || event.id}`;

  return (
    <TenantLink
      href={eventHref}
      className="block bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-white/10 transition-all group"
    >
      {/* Cover Image */}
      <div className="relative h-56 sm:h-64 bg-gradient-to-br from-[#D4836A]/20 to-[#3D3936] overflow-hidden rounded-t-xl">
        {event.imageUrl ? (
          <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Calendar className="w-12 h-12 text-[#D4836A]/40" />
          </div>
        )}

        {/* Event Type Badge */}
        <div className="absolute top-3 left-3">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Countdown Badge */}
        {countdown && !isPast && (
          <div className="absolute top-3 right-3 bg-[#1C1917]/80 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <span className="text-xs font-medium text-[#D4836A]">Starts in {countdown}</span>
          </div>
        )}

        {/* Date Badge */}
        <div className="absolute bottom-3 left-3 bg-[#1C1917]/90 backdrop-blur-sm rounded-lg p-2 text-center min-w-[50px]">
          <div className="text-[#D4836A] text-xs font-semibold uppercase">{dateInfo.month}</div>
          <div className="text-white text-lg font-bold leading-tight">{dateInfo.day}</div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-[#D4836A] transition-colors">
          {event.title}
        </h3>

        {event.description && (
          <p className="text-sm text-[#A8A29E] mb-3 line-clamp-2">{event.description}</p>
        )}

        {/* Event Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-[#78716C]">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {dateInfo.weekday}, {dateInfo.time}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-[#78716C]">
            {event.isOnline ? (
              <>
                <Video className="w-4 h-4 shrink-0" />
                <span>Online Event</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{event.location || event.city || "Location TBA"}</span>
              </>
            )}
          </div>
        </div>

        {/* Attendees */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <EventAttendance event={event}>
              {attendees.length > 0 ? (
                <AttendeeAvatars attendees={attendees} />
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-[#78716C]">
                  <Users className="w-4 h-4" />
                  <span>{goingCount} going</span>
                </div>
              )}
            </EventAttendance>
          </div>

          {/* RSVP Button */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: propagation barrier only; wraps independently-focusable controls */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops click bubbling to the parent card Link; inner controls handle their own keyboard activation */}
          <div onClick={(e) => e.stopPropagation()}>
            {!isPast && event.lumaUrl ? (
              <a
                href={event.lumaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg text-sm font-medium hover:bg-[#C4735A] transition-colors"
              >
                RSVP
              </a>
            ) : !isPast && currentUserId ? (
              <RSVPButton eventId={event.id} userRsvp={userRsvp} onRsvpChange={handleRsvpChange} />
            ) : null}

            {isPast && (
              <span className="text-xs text-[#78716C] bg-[#1C1917] px-2 py-1 rounded">
                Past Event
              </span>
            )}
          </div>
        </div>
      </div>
    </TenantLink>
  );
}

function CalendarView({ events }: { events: Event[] }) {
  const cities = useCities();
  const { defaultTimezone } = useTenantConfig();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const eventsInMonth = events.filter((event) => {
    const eventDate = new Date(event.startTime);
    return eventDate.getMonth() === month && eventDate.getFullYear() === year;
  });

  const getEventsForDay = (day: number) => {
    return eventsInMonth.filter((event) => {
      const eventDate = new Date(event.startTime);
      return eventDate.getDate() === day;
    });
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={prevMonth}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#A8A29E] hover:text-white"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h3 className="text-lg font-semibold text-white">{monthName}</h3>
        <button
          type="button"
          onClick={nextMonth}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#A8A29E] hover:text-white"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-[#78716C] py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startingDay }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static leading placeholders for an empty calendar grid; never reordered
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            return (
              <div
                key={day}
                className={`aspect-square p-1 rounded-lg border transition-colors ${
                  dayEvents.length > 0
                    ? "border-[#D4836A]/30 bg-[#D4836A]/10 cursor-pointer hover:bg-[#D4836A]/20"
                    : "border-transparent hover:bg-white/5"
                } ${isToday ? "ring-2 ring-[#D4836A]" : ""}`}
              >
                <div
                  className={`text-xs text-center ${isToday ? "text-[#D4836A] font-bold" : "text-[#A8A29E]"}`}
                >
                  {day}
                </div>
                {dayEvents.length > 0 && (
                  <div className="flex justify-center mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4836A]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Events List for Current Month */}
      {eventsInMonth.length > 0 && (
        <div className="border-t border-white/[0.06] p-4">
          <h4 className="text-sm font-medium text-[#78716C] mb-3">Events this month</h4>
          <div className="space-y-2">
            {eventsInMonth.slice(0, 5).map((event) => (
              <TenantLink
                key={event.id}
                href={`/events/${event.slug || event.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="text-center min-w-[40px]">
                  <div className="text-[#D4836A] text-xs font-medium">
                    {new Date(event.startTime).toLocaleDateString("en-US", {
                      month: "short",
                      timeZone: getEventTz(event, cities, defaultTimezone),
                    })}
                  </div>
                  <div className="text-white font-bold">
                    {
                      formatEventDate(event.startTime, getEventTz(event, cities, defaultTimezone))
                        .day
                    }
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{event.title}</div>
                  <div className="text-xs text-[#78716C]">
                    {new Date(event.startTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: getEventTz(event, cities, defaultTimezone),
                    })}
                  </div>
                </div>
              </TenantLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventsClient({ initialEvents, currentUserId, isAdmin }: EventsClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [events] = useState(initialEvents);

  const now = new Date();

  const filteredEvents = events
    .filter((event) => {
      const eventDate = new Date(event.startTime);

      switch (activeTab) {
        case "upcoming":
          return eventDate >= now;
        case "past":
          return eventDate < now;
        case "my-rsvps":
          // This would need to be fetched from the server with user's RSVPs
          return event.rsvpData?.userRsvp !== null;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      const dateA = new Date(a.startTime);
      const dateB = new Date(b.startTime);
      return activeTab === "past"
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    });

  const tabs = [
    {
      id: "upcoming" as const,
      label: "Upcoming",
      count: events.filter((e) => new Date(e.startTime) >= now).length,
    },
    {
      id: "past" as const,
      label: "Past",
      count: events.filter((e) => new Date(e.startTime) < now).length,
    },
    { id: "my-rsvps" as const, label: "My RSVPs", count: 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#2D2926] rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#D4836A] text-white"
                  : "text-[#A8A29E] hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? "bg-white/20" : "bg-white/10"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* View Toggle & Create Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#2D2926] rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewType("grid")}
              className={`p-2 rounded-md transition-all ${
                viewType === "grid" ? "bg-white/10 text-white" : "text-[#78716C] hover:text-white"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewType("calendar")}
              className={`p-2 rounded-md transition-all ${
                viewType === "calendar"
                  ? "bg-white/10 text-white"
                  : "text-[#78716C] hover:text-white"
              }`}
              title="Calendar view"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>

          {isAdmin && (
            <TenantLink
              href="/admin/events/new"
              className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] text-white rounded-lg text-sm font-medium hover:bg-[#C4735A] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </TenantLink>
          )}
        </div>
      </div>

      {/* Content */}
      {viewType === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="w-16 h-16 text-[#3D3936] mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No events found</h3>
              <p className="text-[#78716C] text-sm">
                {activeTab === "upcoming"
                  ? "There are no upcoming events scheduled."
                  : activeTab === "past"
                    ? "No past events to display."
                    : "You haven't RSVPed to any events yet."}
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} currentUserId={currentUserId} />
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <CalendarView events={events} />
          </div>
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredEvents.slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} currentUserId={currentUserId} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
