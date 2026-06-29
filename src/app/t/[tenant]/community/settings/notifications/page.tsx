"use client";

import {
  ArrowLeft,
  AtSign,
  Bell,
  Calendar,
  Heart,
  Loader2,
  Mail,
  MessageSquare,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { timezoneForCity } from "@/lib/cities";

interface EmailPreferences {
  mentions: boolean;
  replies: boolean;
  likes: boolean;
  messages: boolean;
  weeklyDigest: boolean;
  eventReminders: boolean;
}

interface LumaInterest {
  eventId: string;
  slug: string | null;
  title: string;
  startTime: string;
  timezone: string | null;
  city: string | null;
}

export default function NotificationSettingsPage() {
  const config = useTenantConfig();
  const cities = useCities();
  const [preferences, setPreferences] = useState<EmailPreferences>({
    mentions: true,
    replies: true,
    likes: false,
    messages: true,
    weeklyDigest: true,
    eventReminders: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lumaInterests, setLumaInterests] = useState<LumaInterest[] | null>(null);
  const [unregistering, setUnregistering] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only fetch; fetchPreferences/fetchLumaInterests are recreated each render and adding them would re-fetch on every render
  useEffect(() => {
    fetchPreferences();
    fetchLumaInterests();
  }, []);

  const fetchLumaInterests = async () => {
    try {
      const res = await fetch("/api/users/luma-interests");
      if (res.ok) {
        setLumaInterests(await res.json());
      } else {
        setLumaInterests([]);
      }
    } catch (error) {
      console.error("Failed to fetch Luma waitlist:", error);
      setLumaInterests([]);
    }
  };

  const unregisterLuma = async (eventId: string) => {
    setUnregistering(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/luma-interest`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLumaInterests((prev) => prev?.filter((i) => i.eventId !== eventId) ?? null);
      }
    } catch (error) {
      console.error("Failed to unregister Luma interest:", error);
    } finally {
      setUnregistering(null);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch("/api/users/email-preferences");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setPreferences(data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) {
        alert("Failed to save preferences");
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      alert("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof EmailPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1C1917] pt-[72px] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1C1917] pt-[72px]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <TenantLink
            href="/community/settings/profile"
            className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </TenantLink>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-[#D4836A]" />
              Notification Settings
            </h1>
            <p className="text-[#78716C] text-sm">Manage how you receive notifications</p>
          </div>
        </div>

        {/* Luma waitlist subscriptions */}
        {lumaInterests && lumaInterests.length > 0 && (
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#D4836A]" />
                <h2 className="text-lg font-semibold text-white">Luma waitlist</h2>
              </div>
              <p className="text-[#78716C] text-sm mt-1">
                Events you've asked to be notified about when the Luma link goes live.
              </p>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {lumaInterests.map((interest) => {
                const tz =
                  interest.timezone ||
                  timezoneForCity(cities, interest.city || "", config.defaultTimezone);
                const when = new Date(interest.startTime).toLocaleString(config.lang, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: tz,
                });
                return (
                  <div
                    key={interest.eventId}
                    className="flex items-center justify-between gap-3 p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <TenantLink
                        href={`/events/${interest.slug || interest.eventId}`}
                        className="text-white font-medium hover:text-[#D4836A] transition-colors block truncate"
                      >
                        {interest.title}
                      </TenantLink>
                      <p className="text-[#78716C] text-sm mt-0.5">
                        {when}
                        {interest.city ? ` · ${interest.city}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => unregisterLuma(interest.eventId)}
                      disabled={unregistering === interest.eventId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#A8A29E] hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {unregistering === interest.eventId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      Unregister
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Email Notifications */}
        <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#D4836A]" />
              <h2 className="text-lg font-semibold text-white">Email Notifications</h2>
            </div>
            <p className="text-[#78716C] text-sm mt-1">
              Choose which notifications you want to receive by email
            </p>
          </div>

          <div className="divide-y divide-white/[0.06]">
            <ToggleRow
              icon={<AtSign className="w-5 h-5 text-[#D4836A]" />}
              title="Mentions"
              description="When someone mentions you in a post or comment"
              enabled={preferences.mentions}
              onToggle={() => togglePreference("mentions")}
            />
            <ToggleRow
              icon={<MessageSquare className="w-5 h-5 text-[#8B5CF6]" />}
              title="Replies"
              description="When someone replies to your post or comment"
              enabled={preferences.replies}
              onToggle={() => togglePreference("replies")}
            />
            <ToggleRow
              icon={<Heart className="w-5 h-5 text-pink-500" />}
              title="Likes"
              description="When someone likes your post"
              enabled={preferences.likes}
              onToggle={() => togglePreference("likes")}
            />
            <ToggleRow
              icon={<Mail className="w-5 h-5 text-[#10B981]" />}
              title="Direct Messages"
              description="When you receive a new direct message"
              enabled={preferences.messages}
              onToggle={() => togglePreference("messages")}
            />
            <ToggleRow
              icon={<Calendar className="w-5 h-5 text-[#F59E0B]" />}
              title="Event Reminders"
              description="Reminders about upcoming events you've RSVP'd to"
              enabled={preferences.eventReminders}
              onToggle={() => togglePreference("eventReminders")}
            />
            <ToggleRow
              icon={<Bell className="w-5 h-5 text-[#3B82F6]" />}
              title="Weekly Digest"
              description="A weekly summary of community activity"
              enabled={preferences.weeklyDigest}
              onToggle={() => togglePreference("weeklyDigest")}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={savePreferences}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] text-white font-semibold rounded-xl hover:bg-[#c4775f] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function ToggleRow({ icon, title, description, enabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-white font-medium">{title}</h3>
          <p className="text-[#78716C] text-sm">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          enabled ? "bg-[#D4836A]" : "bg-white/[0.1]"
        }`}
      >
        <span
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
