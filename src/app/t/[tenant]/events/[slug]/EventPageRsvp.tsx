"use client";

import { Bell, BellOff, Check, CheckCircle2, ExternalLink, Loader2, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";

interface EventPageRsvpProps {
  eventId: string;
  lumaUrl: string | null;
  isPast: boolean;
  rsvpEnabled: boolean;
  isAuthenticated: boolean;
}

export default function EventPageRsvp({
  eventId,
  lumaUrl,
  isPast,
  rsvpEnabled,
  isAuthenticated,
}: EventPageRsvpProps) {
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [lumaInterestRegistered, setLumaInterestRegistered] = useState<boolean | null>(null);
  const [lumaInterestLoading, setLumaInterestLoading] = useState(false);

  // True when we should show the "Notify me when Luma is ready" CTA.
  const isWaitingForLuma = !lumaUrl && !isPast && !rsvpEnabled;

  useEffect(() => {
    if (lumaUrl || isPast || !rsvpEnabled || !isAuthenticated) return;

    let cancelled = false;
    fetch(`/api/events/${eventId}/rsvp`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setRsvpStatus(data.userRsvp);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [eventId, lumaUrl, isPast, rsvpEnabled, isAuthenticated]);

  useEffect(() => {
    if (!isWaitingForLuma || !isAuthenticated) return;

    let cancelled = false;
    fetch(`/api/events/${eventId}/luma-interest`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setLumaInterestRegistered(!!data.registered);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [eventId, isWaitingForLuma, isAuthenticated]);

  const handleRsvp = async (status: string) => {
    setRsvpLoading(true);
    setShowDropdown(false);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
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

  const handleLumaInterestToggle = async () => {
    if (lumaInterestLoading) return;
    setLumaInterestLoading(true);
    const wantOn = !lumaInterestRegistered;
    try {
      const res = await fetch(`/api/events/${eventId}/luma-interest`, {
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

  if (lumaUrl) {
    return (
      <a
        href={lumaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium text-sm"
      >
        <ExternalLink className="w-4 h-4" />
        RSVP on Luma
      </a>
    );
  }

  if (isPast) return null;

  if (isWaitingForLuma) {
    if (!isAuthenticated) {
      return (
        <div className="space-y-3">
          <TenantLink
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium text-sm"
          >
            <Bell className="w-4 h-4" />
            Sign in to get the Luma link
          </TenantLink>
          <p className="text-xs text-[#78716C] leading-relaxed max-w-md">
            Registration isn't open yet. Sign in and we'll email you the Luma link as soon as it's
            ready — you'll still need to RSVP on Luma to secure your spot.
          </p>
        </div>
      );
    }

    const registered = lumaInterestRegistered === true;
    return (
      <div className="space-y-3">
        {registered && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            You're on the waitlist
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={handleLumaInterestToggle}
            disabled={lumaInterestLoading}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all border ${
              registered
                ? "bg-[#2D2926] text-[#A8A29E] border-white/10 hover:bg-[#3D3936]"
                : "bg-[#D4836A] text-white border-transparent hover:bg-[#C4735A]"
            } disabled:opacity-60`}
          >
            {lumaInterestLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : registered ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>{registered ? "Cancel notification" : "Notify me when Luma is ready"}</span>
          </button>
        </div>
        <p className="text-xs text-[#78716C] leading-relaxed max-w-md">
          {registered ? (
            <>
              We'll send you an in-app notification and an email with the Luma link as soon as it's
              ready. You'll still need to RSVP on Luma to secure your spot.{" "}
              <TenantLink
                href="/community/settings/notifications"
                className="text-[#A8A29E] underline hover:text-white"
              >
                Manage all waitlist subscriptions
              </TenantLink>
              .
            </>
          ) : (
            "Registration isn't open yet. We'll send you an in-app notification and an email with the Luma link as soon as it's ready — this does not reserve a spot, you'll still need to RSVP on Luma."
          )}
        </p>
      </div>
    );
  }

  if (!rsvpEnabled) {
    return <p className="text-sm text-[#78716C] italic">RSVP coming later</p>;
  }

  if (!isAuthenticated) {
    return (
      <TenantLink
        href="/login"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white rounded-lg hover:bg-[#C4735A] transition-colors font-medium text-sm"
      >
        Sign in to RSVP
      </TenantLink>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={rsvpLoading}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all border ${getRsvpButtonStyle()}`}
      >
        {getRsvpButtonContent()}
      </button>

      {showDropdown && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
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
  );
}
