"use client";

import {
  Bell,
  BellOff,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Star,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { timezoneForCity } from "@/lib/cities";
import LessonContent from "./LessonContent";

export interface Event {
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
  isOnline: boolean;
  meetingUrl: string | null;
  imageUrl: string | null;
  lumaUrl: string | null;
  rsvpEnabled?: boolean;
  _count?: { rsvps: number };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: reducing this requires extracting a stateful RSVP-action child component (the lumaUrl/auth/past-event ternary tree at lines 298-403) which is out of scope for a lint pass
export default function EventDetailModal({
  event,
  onClose,
}: {
  event: Event | null;
  onClose: () => void;
}) {
  const config = useTenantConfig();
  const cities = useCities();
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [lumaInterestRegistered, setLumaInterestRegistered] = useState<boolean | null>(null);
  const [lumaInterestLoading, setLumaInterestLoading] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch RSVP status when modal opens for non-Luma events
  useEffect(() => {
    if (!event || event.lumaUrl || !event.rsvpEnabled) {
      setRsvpStatus(null);
      setIsAuthenticated(null);
      return;
    }

    const isPast = new Date(event.startTime) <= new Date();
    if (isPast) return;

    let cancelled = false;
    fetch(`/api/events/${event.id}/rsvp`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setRsvpStatus(data.userRsvp);
          setIsAuthenticated(data.isAuthenticated);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.lumaUrl, event?.rsvpEnabled, event?.startTime, event]);

  // Fetch Luma-interest waitlist status for the "Notify me when Luma is ready" CTA.
  useEffect(() => {
    if (!event) return;
    const showsNotifyCta =
      !event.lumaUrl && !event.rsvpEnabled && new Date(event.startTime) > new Date();
    if (!showsNotifyCta) {
      setLumaInterestRegistered(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/events/${event.id}/luma-interest`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setLumaInterestRegistered(!!data.registered);
          setIsAuthenticated(!!data.isAuthenticated);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.lumaUrl, event?.rsvpEnabled, event?.startTime, event]);

  if (!event) return null;

  const isPastEvent = new Date(event.startTime) <= new Date();

  const { lang, defaultTimezone } = config;
  const tz = event.timezone || timezoneForCity(cities, event.city || "", defaultTimezone);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(lang, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString(lang, {
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

  const eventTypeBadgeColor = event.isOnline
    ? "bg-blue-500/20 text-blue-400"
    : event.eventType === "workshop"
      ? "bg-amber-500/20 text-amber-400"
      : event.eventType === "conference"
        ? "bg-rose-500/20 text-rose-400"
        : event.eventType === "hybrid"
          ? "bg-purple-500/20 text-purple-400"
          : "bg-green-500/20 text-green-400";

  const handleLumaInterestToggle = async () => {
    if (!event || lumaInterestLoading) return;
    setLumaInterestLoading(true);
    const wantOn = !lumaInterestRegistered;
    try {
      const res = await fetch(`/api/events/${event.id}/luma-interest`, {
        method: wantOn ? "POST" : "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setLumaInterestRegistered(!!data.registered);
      }
    } catch (error) {
      console.error("Failed to update Luma interest:", error);
    } finally {
      setLumaInterestLoading(false);
    }
  };

  const handleRsvp = async (status: string) => {
    setRsvpLoading(true);
    setShowDropdown(false);
    try {
      const res = await fetch(`/api/events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setRsvpStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to update RSVP:", error);
    } finally {
      setRsvpLoading(false);
    }
  };

  const getRsvpButtonContent = () => {
    if (rsvpLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
    switch (rsvpStatus) {
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

  const getRsvpButtonStyle = () => {
    switch (rsvpStatus) {
      case "going":
        return "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30";
      case "interested":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30";
      default:
        return "bg-[#D4836A] text-white border-transparent hover:bg-[#C4735A]";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-[#2D2926] rounded-2xl border border-white/[0.1] w-full max-w-lg max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Image */}
        <div className="relative h-48 shrink-0 bg-gradient-to-br from-[#D4836A]/20 to-[#3D3936] flex items-center justify-center overflow-hidden rounded-t-2xl">
          {event.imageUrl ? (
            <RemoteImage
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-contain"
            />
          ) : null}

          {/* Event type badge */}
          <div className="absolute top-3 left-3">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${eventTypeBadgeColor}`}>
              {eventTypeLabel}
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">{event.title}</h2>

          <div className="space-y-2.5 mb-4">
            <div className="flex items-center gap-2 text-sm text-[#A8A29E]">
              <Clock className="w-4 h-4 shrink-0 text-[#78716C]" />
              <span>
                {formatDate(event.startTime)} at {formatTime(event.startTime)}
                {event.endTime && ` – ${formatTime(event.endTime)}`}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-[#A8A29E]">
              {event.isOnline ? (
                <>
                  <Video className="w-4 h-4 shrink-0 text-[#78716C]" />
                  <span>Online Event</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 shrink-0 text-[#78716C]" />
                  <span>{event.location || event.city || "Location TBA"}</span>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="text-sm text-[#A8A29E] mb-5 leading-relaxed">
              <LessonContent content={event.description} />
            </div>
          )}

          {/* RSVP action */}
          {event.lumaUrl ? (
            <a
              href={event.lumaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              RSVP on Luma
            </a>
          ) : !isPastEvent && !event.rsvpEnabled ? (
            isAuthenticated === false ? (
              <div className="space-y-2">
                <TenantLink
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium text-sm"
                >
                  <Bell className="w-4 h-4" />
                  Sign in to get the Luma link
                </TenantLink>
                <p className="text-xs text-[#78716C] leading-relaxed">
                  Registration isn't open yet. Sign in and we'll email you the Luma link when it's
                  ready — you'll still need to RSVP on Luma to secure your spot.
                </p>
              </div>
            ) : isAuthenticated === null ? null : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleLumaInterestToggle}
                  disabled={lumaInterestLoading}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    lumaInterestRegistered
                      ? "bg-[#2D2926] text-[#A8A29E] border-white/10 hover:bg-[#3D3936]"
                      : "bg-[#D4836A] text-white border-transparent hover:bg-[#C4735A]"
                  } disabled:opacity-60`}
                >
                  {lumaInterestLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : lumaInterestRegistered ? (
                    <BellOff className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  <span>
                    {lumaInterestRegistered
                      ? "Cancel notification"
                      : "Notify me when Luma is ready"}
                  </span>
                </button>
                <p className="text-xs text-[#78716C] leading-relaxed">
                  {lumaInterestRegistered
                    ? "You're on the list. We'll send you an in-app notification and an email with the Luma link. You'll still need to RSVP on Luma to secure your spot."
                    : "Registration isn't open yet. We'll notify you with the Luma link when it's ready — this does not reserve a spot, you'll still need to RSVP on Luma."}
                </p>
              </div>
            )
          ) : !isPastEvent && isAuthenticated === false ? (
            <TenantLink
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium text-sm"
            >
              Sign in to RSVP
            </TenantLink>
          ) : !isPastEvent && isAuthenticated ? (
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={rsvpLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border ${getRsvpButtonStyle()}`}
              >
                {getRsvpButtonContent()}
              </button>

              {showDropdown && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute left-0 mt-2 w-40 bg-[#2D2926] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleRsvp("going")}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 ${rsvpStatus === "going" ? "text-green-400" : "text-[#E7E5E4]"}`}
                    >
                      <Check className="w-4 h-4" />
                      Going
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRsvp("interested")}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 ${rsvpStatus === "interested" ? "text-amber-400" : "text-[#E7E5E4]"}`}
                    >
                      <Star className="w-4 h-4" />
                      Interested
                    </button>
                    {rsvpStatus && (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
