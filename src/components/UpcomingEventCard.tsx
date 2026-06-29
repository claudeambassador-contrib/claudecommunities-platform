"use client";

import { Clock, MapPin, Users } from "lucide-react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Event {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  _count?: {
    attendees: number;
  };
}

interface UpcomingEventCardProps {
  event: Event;
}

export default function UpcomingEventCard({ event }: UpcomingEventCardProps) {
  const { lang } = useTenantConfig();
  const date = new Date(event.startTime);
  const day = date.getDate();
  const month = date.toLocaleDateString(lang, { month: "short" });
  const time = date.toLocaleTimeString(lang, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const weekday = date.toLocaleDateString(lang, { weekday: "long" });

  const attendeeCount = event._count?.attendees || 0;

  return (
    <TenantLink
      href={`/events/${event.slug || event.id}`}
      className="block bg-gradient-to-br from-[#2D2926] to-[#262220] rounded-2xl border border-white/[0.06] hover:border-[#8B5CF6]/30 transition-all duration-200 overflow-hidden group"
    >
      <div className="flex">
        {/* Date Badge */}
        <div className="w-20 flex-shrink-0 bg-gradient-to-br from-[#8B5CF6]/20 to-[#8B5CF6]/5 flex flex-col items-center justify-center py-4 border-r border-white/[0.06]">
          <span className="text-sm text-[#8B5CF6] font-medium uppercase">{month}</span>
          <span className="text-3xl font-bold text-white">{day}</span>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          <h3 className="font-semibold text-white group-hover:text-[#8B5CF6] transition-colors mb-1 line-clamp-1">
            {event.title}
          </h3>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-[#78716C]">
              <Clock className="w-4 h-4" />
              <span>
                {weekday} at {time}
              </span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-[#78716C]">
                <MapPin className="w-4 h-4" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#78716C]" />
              <span className="text-[#78716C]">{attendeeCount} attending</span>
            </div>
          </div>
        </div>
      </div>
    </TenantLink>
  );
}
