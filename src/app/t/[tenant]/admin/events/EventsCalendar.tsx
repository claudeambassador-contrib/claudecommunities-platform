"use client";

import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enAU, enNZ } from "date-fns/locale";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import "./calendar.css";
import { useTenantConfig } from "@/components/TenantConfigProvider";

export interface CalendarEventLike {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  eventType: string;
  timezone: string | null;
}

interface Props {
  events: CalendarEventLike[];
  onSelectEvent: (eventId: string) => void;
}

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEventLike;
}

function toRbcEvent(e: CalendarEventLike): RbcEvent {
  const start = new Date(e.startTime);
  const end = e.endTime ? new Date(e.endTime) : new Date(start.getTime() + 60 * 60 * 1000);
  return { id: e.id, title: e.title, start, end, resource: e };
}

const EVENT_TYPE_BG: Record<string, string> = {
  workshop: "bg-purple-500/30 border-purple-400/60 text-purple-100",
  hackathon: "bg-green-500/30 border-green-400/60 text-green-100",
  social: "bg-blue-500/30 border-blue-400/60 text-blue-100",
  meetup: "bg-[#E07A5F]/30 border-[#E07A5F]/60 text-[#ffe2d7]",
};

function eventChipClass(eventType: string): string {
  return EVENT_TYPE_BG[eventType] ?? EVENT_TYPE_BG.meetup;
}

function formatEventTime(e: CalendarEventLike, lang: string, defaultTimezone: string): string {
  const tz = e.timezone || defaultTimezone;
  return new Date(e.startTime).toLocaleTimeString(lang, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/* ------------------------------------------------------------------ */
/* Custom infinite-scroll month view (per-month blocks)               */
/* ------------------------------------------------------------------ */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(monthDate: Date): Date[] {
  // 6 weeks × 7 days, starting Monday, ending Sunday.
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function MonthBlock({
  monthDate,
  eventsByDay,
  onSelectEvent,
  lang,
  defaultTimezone,
}: {
  monthDate: Date;
  eventsByDay: Map<string, CalendarEventLike[]>;
  onSelectEvent: (id: string) => void;
  lang: string;
  defaultTimezone: string;
}) {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  return (
    <section className="mb-8">
      <div className="sticky top-0 z-20 bg-[#1a1a1a]/95 backdrop-blur-sm border-b border-[#2f2f2f] px-1 py-2 mb-2">
        <h3 className="text-lg font-semibold text-white">{format(monthDate, "MMMM yyyy")}</h3>
      </div>
      <div className="grid grid-cols-7 gap-px bg-[#2f2f2f] border border-[#2f2f2f] rounded-lg overflow-hidden">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="bg-[#1f1f1f] text-xs font-medium text-gray-400 px-2 py-1.5 text-center"
          >
            {w}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthDate);
          const isToday = isSameDay(day, today);
          const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[96px] p-1.5 text-xs ${inMonth ? "bg-[#1a1a1a]" : "bg-[#161616]"}`}
            >
              <div
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] mb-1 ${
                  isToday
                    ? "bg-[#E07A5F] text-white font-semibold"
                    : inMonth
                      ? "text-gray-300"
                      : "text-gray-600"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => onSelectEvent(e.id)}
                    className={`w-full text-left truncate px-1.5 py-0.5 rounded border text-[11px] leading-tight ${eventChipClass(e.eventType)} hover:opacity-90`}
                    title={`${e.title} — ${formatEventTime(e, lang, defaultTimezone)}`}
                  >
                    <span className="font-medium">{formatEventTime(e, lang, defaultTimezone)}</span>{" "}
                    <span className="opacity-90">{e.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function InfiniteMonthView({
  events,
  onSelectEvent,
  lang,
  defaultTimezone,
}: {
  events: CalendarEventLike[];
  onSelectEvent: (id: string) => void;
  lang: string;
  defaultTimezone: string;
}) {
  // offsets relative to the current month — e.g. [-1, 0, 1, 2] means previous, current, next two.
  const [offsets, setOffsets] = useState<number[]>(() => [-1, 0, 1, 2]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  // Used to lock the visible content's scroll position when we prepend months.
  const pendingPrependAnchor = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  const baseMonth = useMemo(() => startOfMonth(new Date()), []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventLike[]>();
    for (const e of events) {
      const key = dayKey(new Date(e.startTime));
      const list = map.get(key);
      if (list) {
        list.push(e);
      } else {
        map.set(key, [e]);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [events]);

  // After a prepend, restore scroll position so the user's view doesn't jump.
  // `offsets` is the intentional trigger: the effect doesn't read it, but it
  // must re-run after the month list grows (offsets changed) to re-anchor scroll.
  // biome-ignore lint/correctness/useExhaustiveDependencies: offsets is a deliberate re-run trigger, not a read dependency — removing it skips the post-prepend scroll restore
  useEffect(() => {
    const anchor = pendingPrependAnchor.current;
    const container = scrollRef.current;
    if (anchor && container) {
      const delta = container.scrollHeight - anchor.scrollHeight;
      container.scrollTop = anchor.scrollTop + delta;
      pendingPrependAnchor.current = null;
    }
  }, [offsets]);

  const extendUp = useCallback(() => {
    const container = scrollRef.current;
    if (container) {
      pendingPrependAnchor.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
    }
    setOffsets((prev) => {
      const next = prev[0] - 1;
      return [next, ...prev];
    });
  }, []);

  const extendDown = useCallback(() => {
    setOffsets((prev) => {
      const next = prev[prev.length - 1] + 1;
      return [...prev, next];
    });
  }, []);

  // Observe sentinels to add months on demand.
  useEffect(() => {
    const container = scrollRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!container || !topEl || !bottomEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === bottomEl) {
            extendDown();
          } else if (entry.target === topEl) {
            extendUp();
          }
        }
      },
      { root: container, rootMargin: "200px 0px" },
    );
    observer.observe(topEl);
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [extendDown, extendUp]);

  // Scroll the current month into view on first render — synchronously, before
  // paint and before the IntersectionObserver attaches, so the top sentinel
  // doesn't accidentally trigger extendUp.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const current = container.querySelector<HTMLElement>("[data-current-month='true']");
    if (current) {
      container.scrollTop = current.offsetTop - 8;
    }
  }, []);

  return (
    <div ref={scrollRef} className="relative max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
      <div ref={topSentinelRef} className="h-px" />
      {offsets.map((offset) => {
        const monthDate = addMonths(baseMonth, offset);
        return (
          <div key={offset} data-current-month={offset === 0 ? "true" : undefined}>
            <MonthBlock
              monthDate={monthDate}
              eventsByDay={eventsByDay}
              onSelectEvent={onSelectEvent}
              lang={lang}
              defaultTimezone={defaultTimezone}
            />
          </div>
        );
      })}
      <div ref={bottomSentinelRef} className="h-px" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Outer component: view toggle (Week / Month)                        */
/* ------------------------------------------------------------------ */

export default function EventsCalendar({ events, onSelectEvent }: Props) {
  const { lang, defaultTimezone } = useTenantConfig();
  const [view, setView] = useState<"week" | "month">("month");

  const rbcEvents = useMemo(() => events.map(toRbcEvent), [events]);

  const localizer = useMemo(() => {
    const locales = { [lang]: lang === "en-NZ" ? enNZ : enAU };
    return dateFnsLocalizer({
      format,
      parse,
      startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
      getDay,
      locales,
    });
  }, [lang]);

  return (
    <div className="cc-rbc-wrap">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-[#2D2926] rounded-lg p-1 flex">
          <button
            type="button"
            onClick={() => setView("month")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === "month" ? "bg-[#D4836A] text-white" : "text-[#a8a29e] hover:text-white"
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === "week" ? "bg-[#D4836A] text-white" : "text-[#a8a29e] hover:text-white"
            }`}
          >
            Week
          </button>
        </div>
        {view === "month" && (
          <span className="text-xs text-gray-500">Scroll up/down to navigate months</span>
        )}
      </div>

      {view === "month" ? (
        <InfiniteMonthView
          events={events}
          onSelectEvent={onSelectEvent}
          lang={lang}
          defaultTimezone={defaultTimezone}
        />
      ) : (
        <div className="h-[calc(100vh-220px)] bg-[#1a1a1a] rounded-lg p-2">
          <Calendar
            localizer={localizer}
            culture={lang}
            events={rbcEvents}
            defaultView={"week" as View}
            view={"week" as View}
            views={["week"]}
            onView={() => {
              /* single view, ignore */
            }}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={(e: RbcEvent) => onSelectEvent(e.id)}
            popup
            style={{ height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
