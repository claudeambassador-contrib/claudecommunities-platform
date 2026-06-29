"use client";

import { format, getDay, parse, startOfWeek } from "date-fns";
import { enAU } from "date-fns/locale";
import { useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../app/t/[tenant]/admin/events/calendar.css";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import type { SocialPostSummary } from "@/lib/social/types";

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SocialPostSummary;
}

interface Props {
  posts: SocialPostSummary[];
  onSelect: (post: SocialPostSummary) => void;
}

const STATUS_BG: Record<SocialPostSummary["status"], string> = {
  draft: "bg-white/10 border-white/20 text-white",
  scheduled: "bg-[#D4836A]/40 border-[#D4836A]/60 text-white",
  publishing: "bg-yellow-500/40 border-yellow-400/60 text-yellow-50",
  published: "bg-emerald-500/40 border-emerald-400/60 text-emerald-50",
  failed: "bg-red-500/40 border-red-400/60 text-red-50",
  cancelled: "bg-white/[0.06] border-white/10 text-[#78716C]",
};

export function SocialCalendar({ posts, onSelect }: Props) {
  const { lang } = useTenantConfig();
  const locales = { [lang]: enAU };

  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
    getDay,
    locales,
  });

  const events = useMemo<RbcEvent[]>(
    () =>
      posts
        .filter((p) => p.scheduledAt || p.publishedAt)
        .map((p) => {
          const ts = p.scheduledAt ?? p.publishedAt;
          const start = new Date(ts ?? Date.now());
          // Each post takes a single time slot; render as a 30-min event.
          const end = new Date(start.getTime() + 30 * 60 * 1000);
          return {
            id: p.id,
            title: p.content.slice(0, 60),
            start,
            end,
            resource: p,
          };
        }),
    [posts],
  );

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#2D2926] p-4 social-calendar">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={["month", "week", "agenda"]}
        defaultView="month"
        culture={lang}
        style={{ height: 700 }}
        onSelectEvent={(e: RbcEvent) => onSelect(e.resource)}
        eventPropGetter={(e: RbcEvent) => ({
          className: STATUS_BG[e.resource.status],
        })}
        components={{
          event: ({ event }: { event: RbcEvent }) => (
            <div className="text-xs leading-tight px-1 truncate">{event.title}</div>
          ),
        }}
      />
    </div>
  );
}
