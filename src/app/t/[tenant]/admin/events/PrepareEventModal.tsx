"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Coffee,
  Copy,
  GripVertical,
  Loader2,
  Mic,
  Plus,
  Presentation,
  Settings,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SlideSpeaker } from "@/components/slide-generator";
import { SpeakerSlideGenerator } from "@/components/slide-generator";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { escapeHtml } from "@/lib/escape-html";
import { type AgendaItem, type DescriptionFormat, renderDescription } from "./agendaToDescription";
import ClaudienceSection from "./ClaudienceSection";
import EventDetailsTab, { type EventDetails } from "./EventDetailsTab";
import { type EmailBlastKind, renderBlast } from "./emailBlasts";
import SpeakersPanel, { type EventSpeaker } from "./SpeakersPanel";

type PrepareTab = "details" | "agenda" | "speakers" | "slides";

type AgendaType = "speaker" | "welcome" | "break" | "custom";

function buildDefaultHeader(communityName: string): string {
  return `${communityName} is excited to host a Claude Code Meetup.

Limited Spots. Good people. Local Builders.`;
}

const DEFAULT_FOOTER = `What is Claude Code?

Claude Code is Anthropic's agentic coding tool that lives in your terminal. It lets you delegate coding tasks directly to Claude—whether you're building new features, debugging tricky issues, refactoring legacy code, or exploring unfamiliar codebases. Just describe what you want in natural language, and Claude Code handles the rest: reading files, making edits, running commands, and iterating until the job is done.

Think of it as pair programming with an AI that can actually touch your codebase. No copy-pasting between a chat window and your editor—Claude Code works where you work.

PHOTOGRAPHY DISCLAIMER: We will have a photographer on site to take photos for our community event page, and social media coverage.`;

function buildDefaultAgenda(countryName: string): Array<{
  type: AgendaType;
  offsetMin: number;
  durationMin: number;
  title: string;
  description?: string;
}> {
  return [
    {
      type: "welcome",
      offsetMin: 0,
      durationMin: 45,
      title: "Doors Open & Networking",
      description:
        "Kick things off — meet fellow AI-curious minds, and warm up before the main program begins.",
    },
    {
      type: "welcome",
      offsetMin: 45,
      durationMin: 15,
      title: "Opening: Why We're Here",
      description: `A quick intro to set the vibe for ${countryName}'s growing Claude community!`,
    },
    { type: "speaker", offsetMin: 60, durationMin: 20, title: "Lightning talk" },
    { type: "speaker", offsetMin: 80, durationMin: 20, title: "Lightning talk" },
    {
      type: "break",
      offsetMin: 100,
      durationMin: 25,
      title: "Break — Networking and Pizza",
      description:
        "Have a slice of pizza, a beverage, and mix and mingle. Meet your local community.",
    },
    { type: "speaker", offsetMin: 125, durationMin: 20, title: "Lightning talk" },
    { type: "speaker", offsetMin: 145, durationMin: 20, title: "Lightning talk" },
    {
      type: "custom",
      offsetMin: 165,
      durationMin: 10,
      title: "Community announcements & Q&A",
      description: "Community announcements, next meetings, Q&A.",
    },
  ];
}

interface PrepareEvent {
  id: string;
  title: string;
  startTime: string;
  timezone: string | null;
  headerText?: string | null;
  footerText?: string | null;
  location?: string | null;
  city?: string | null;
  eventType?: string;
  maxAttendees?: number | null;
  isOnline?: boolean;
  meetingUrl?: string | null;
  lumaUrl?: string | null;
  imageUrl?: string | null;
  rsvpEnabled?: boolean;
  isActive?: boolean;
  feedbackUrl?: string | null;
  claudienceSessionCode?: string | null;
  claudienceSessionPassword?: string | null;
  claudienceSessionUrl?: string | null;
  claudienceSurveyId?: string | null;
  claudienceSurveyUrl?: string | null;
  claudienceNotificationEmail?: string | null;
}

interface PrepareEventModalProps {
  /** When null, the modal is in "create" mode — only the Details tab is shown. */
  event: PrepareEvent | null;
  onClose: () => void;
  onEventUpdate: (patch: Partial<PrepareEvent>) => void;
  /** Called after a brand-new event is created so the parent can swap it in. */
  onEventCreated?: (created: PrepareEvent) => void;
}

const TYPE_META: Record<
  AgendaType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  speaker: { label: "Speaker", icon: Mic, color: "text-[#E07A5F]" },
  welcome: { label: "Welcome", icon: Sparkles, color: "text-yellow-400" },
  break: { label: "Break", icon: Coffee, color: "text-blue-400" },
  custom: { label: "Custom", icon: Plus, color: "text-gray-400" },
};

/** Convert ISO → local datetime-local input value ("YYYY-MM-DDTHH:mm"). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Format an event's start ISO into a `YYYY-MM-DD` date in its timezone, for
 * the slide generator's date input (which is `<input type="date">`).
 * `en-CA` is used because it's the locale that natively produces ISO-style
 * dates, sidestepping manual padding.
 */
function isoToSlideDate(iso: string | null | undefined, tz: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString("en-CA", { timeZone: tz || undefined });
  } catch {
    return d.toLocaleDateString("en-CA");
  }
}

/** Minimal markdown → HTML for preview only; escapes input first. */
function renderMarkdownPreview(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-base font-semibold text-white mt-3 mb-1">$1</h3>',
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-lg font-semibold text-white mt-3 mb-1">$1</h2>',
  );
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-3 mb-1">$1</h1>');
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-white/10 px-1 rounded text-[#D4836A] text-sm">$1</code>',
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#D4836A] underline">$1</a>',
  );
  html = html.replace(
    /(?<!href=")(https?:\/\/[^\s<>"')\]]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#D4836A] underline break-all">$1</a>',
  );
  html = html.replace(/^- (.+)$/gm, '<li class="ml-5 list-disc">$1</li>');
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    '<ul class="my-2 space-y-1 text-gray-200">$&</ul>',
  );
  // Paragraphs from blank-line separated blocks
  html = html
    .split(/\n{2,}/)
    .map((block) =>
      block.startsWith("<")
        ? block
        : `<p class="text-gray-200 leading-relaxed">${block.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");
  return html;
}

export default function PrepareEventModal({
  event,
  onClose,
  onEventUpdate,
  onEventCreated,
}: PrepareEventModalProps) {
  const [justCreated, setJustCreated] = useState(false);
  if (event === null) {
    return (
      <CreateEventShell
        onClose={onClose}
        onCreated={(ev) => {
          setJustCreated(true);
          onEventCreated?.(ev);
        }}
      />
    );
  }
  return (
    <ExistingEventEditor
      event={event}
      onClose={onClose}
      onEventUpdate={onEventUpdate}
      initialTab={justCreated ? "agenda" : "details"}
    />
  );
}

function CreateEventShell({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (created: PrepareEvent) => void;
}) {
  const lockedTabTitle = "Save the event first to unlock this tab";
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1f1f1f] rounded-xl w-full max-w-7xl h-[92vh] flex flex-col border border-[#333]">
        <div className="px-6 py-4 border-b border-[#333] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">Prepare event</h2>
            <p className="text-sm text-gray-400 truncate">
              Fill in the basics, then the Agenda, Speakers and Slide Generator tabs unlock.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-[#2a2a2a] border border-[#444] rounded-lg p-0.5 mr-3">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[#E07A5F] text-white"
            >
              <Settings className="w-3.5 h-3.5" />
              Details
            </button>
            <button
              type="button"
              disabled
              title={lockedTabTitle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 cursor-not-allowed"
            >
              <Mic className="w-3.5 h-3.5" />
              Agenda &amp; Description
            </button>
            <button
              type="button"
              disabled
              title={lockedTabTitle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 cursor-not-allowed"
            >
              <Users className="w-3.5 h-3.5" />
              Speakers
            </button>
            <button
              type="button"
              disabled
              title={lockedTabTitle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 cursor-not-allowed"
            >
              <Presentation className="w-3.5 h-3.5" />
              Slide Generator
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <EventDetailsTab
          initial={null}
          generatedDescription=""
          onSaved={(saved) => onCreated?.(saved as PrepareEvent)}
        />
      </div>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrates ~20 interdependent state slices and the full agenda/description/blast editor; splitting risks behavior changes on a lint pass.
function ExistingEventEditor({
  event,
  onClose,
  onEventUpdate,
  initialTab = "details",
}: {
  event: PrepareEvent;
  onClose: () => void;
  onEventUpdate: (patch: Partial<PrepareEvent>) => void;
  initialTab?: PrepareTab;
}) {
  const toast = useToast();
  const { communityName, countryName, lang, siteUrl } = useTenantConfig();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [headerText, setHeaderText] = useState(event.headerText || "");
  const [footerText, setFooterText] = useState(event.footerText || "");
  const [headerFooterSaving, setHeaderFooterSaving] = useState(false);

  const [descFormat, setDescFormat] = useState<DescriptionFormat>("plain");
  const [copied, setCopied] = useState(false);

  const [feedbackUrl, setFeedbackUrl] = useState(event.feedbackUrl || "");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [blastKind, setBlastKind] = useState<EmailBlastKind>("morning-of");
  const [blastDraft, setBlastDraft] = useState("");
  const [blastDirty, setBlastDirty] = useState(false);
  const [blastCopied, setBlastCopied] = useState(false);

  const [defaultsConfirmOpen, setDefaultsConfirmOpen] = useState(false);
  const [defaultsInserting, setDefaultsInserting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgendaItem | null>(null);

  // Live drag preview: the dragged item's end time changes by `deltaMs`, and
  // every later item's start AND end shift by the same delta. Nothing is sent
  // to the server until release — handled in onResize / updateEndTimeWithCascade.
  const [resizePreview, setResizePreview] = useState<{ itemId: string; deltaMs: number } | null>(
    null,
  );

  const [tab, setTab] = useState<PrepareTab>(initialTab);

  // Per-event canonical speaker list. Source of truth for the Speakers tab,
  // the agenda's speaker dropdown, and the Slide Generator.
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [, setSpeakersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${event.id}/speakers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as EventSpeaker[];
        if (!cancelled) setSpeakers(data);
      } catch (err) {
        console.error("Failed to load speakers:", err);
      } finally {
        if (!cancelled) setSpeakersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  // Re-fetch speakers; called when leaving the Speakers tab so the agenda
  // dropdown and slide generator see the latest list.
  const refreshSpeakers = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${event.id}/speakers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSpeakers((await res.json()) as EventSpeaker[]);
    } catch (err) {
      console.error("Failed to refresh speakers:", err);
    }
  }, [event.id]);

  // Pull the latest speakers whenever the tab changes, except while the
  // Speakers tab is open (the panel manages its own state then).
  useEffect(() => {
    if (tab !== "speakers") void refreshSpeakers();
  }, [tab, refreshSpeakers]);

  // Adapt EventSpeaker → SlideSpeaker for the slide generator.
  const slideSpeakers = useMemo<SlideSpeaker[]>(
    () =>
      speakers.map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        company: s.company,
        talk_title: s.talkTitle,
        talk_description: s.talkDescription,
        talk_description_short: s.talkDescriptionShort,
        headshot_url: s.headshotUrl,
        company_logo_url: s.companyLogoUrl,
        twitter_handle: s.twitterHandle,
        linkedin_url: s.linkedinUrl,
        website_url: s.websiteUrl,
      })),
    [speakers],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${event.id}/agenda`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AgendaItem[];
        if (!cancelled) {
          setItems(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load agenda:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  // Per-item time override while a resize drag is in progress. The dragged
  // item gets its endTime shifted; every later item gets both start AND end
  // shifted by the same delta — mirroring what updateEndTimeWithCascade will
  // persist on release.
  const resizePreviewMap = useMemo<Record<string, AgendaItem> | null>(() => {
    if (!resizePreview || resizePreview.deltaMs === 0) return null;
    const idx = items.findIndex((i) => i.id === resizePreview.itemId);
    if (idx < 0) return null;
    const result: Record<string, AgendaItem> = {};
    const dragged = items[idx];
    if (dragged.endTime) {
      const newEnd = new Date(
        new Date(dragged.endTime).getTime() + resizePreview.deltaMs,
      ).toISOString();
      result[dragged.id] = { ...dragged, endTime: newEnd };
    }
    for (let j = idx + 1; j < items.length; j++) {
      const it = items[j];
      if (it.startTime && it.endTime) {
        const ns = new Date(new Date(it.startTime).getTime() + resizePreview.deltaMs).toISOString();
        const ne = new Date(new Date(it.endTime).getTime() + resizePreview.deltaMs).toISOString();
        result[it.id] = { ...it, startTime: ns, endTime: ne };
      }
    }
    return result;
  }, [resizePreview, items]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId],
  );

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: start-time fallback chain plus the middle-insert cascade-and-reorder are tightly coupled; extracting risks the insert ordering.
  const addItem = async (type: AgendaType) => {
    setShowAddMenu(false);

    // Anchor = currently selected item if any, else the last item.
    const selectedIndex = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
    const anchorIndex = selectedIndex >= 0 ? selectedIndex : items.length - 1;
    const anchor = anchorIndex >= 0 ? items[anchorIndex] : null;

    const SLOT_MIN = 15;
    const SLOT_MS = SLOT_MIN * 60_000;

    // Pick the new item's start time: end of anchor → fall back to its start
    // + 15 min → fall back to the event's start time.
    let startMs: number | null = null;
    if (anchor?.endTime) {
      const ms = new Date(anchor.endTime).getTime();
      if (!Number.isNaN(ms)) startMs = ms;
    }
    if (startMs == null && anchor?.startTime) {
      const ms = new Date(anchor.startTime).getTime();
      if (!Number.isNaN(ms)) startMs = ms + SLOT_MS;
    }
    if (startMs == null && event.startTime) {
      const ms = new Date(event.startTime).getTime();
      if (!Number.isNaN(ms)) startMs = ms;
    }
    const startTime = startMs != null ? new Date(startMs).toISOString() : null;
    const endTime = startMs != null ? new Date(startMs + SLOT_MS).toISOString() : null;

    try {
      const res = await fetch(`/api/admin/events/${event.id}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, startTime, endTime }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = (await res.json()) as AgendaItem;

      const isMiddleInsert = anchorIndex >= 0 && anchorIndex < items.length - 1;

      if (!isMiddleInsert) {
        setItems((prev) => [...prev, created]);
        setSelectedId(created.id);
        return;
      }

      // Splice the new item in right after the anchor, shifting every later
      // item by SLOT_MIN so the inserted slot doesn't overlap.
      const shift = (iso: string | null) =>
        iso ? new Date(new Date(iso).getTime() + SLOT_MS).toISOString() : null;
      const before = items.slice(0, anchorIndex + 1);
      const after = items
        .slice(anchorIndex + 1)
        .map((i) => ({ ...i, startTime: shift(i.startTime), endTime: shift(i.endTime) }));
      const next = [...before, created, ...after];
      setItems(next);
      setSelectedId(created.id);

      try {
        const entries = next.map((i) => ({
          id: i.id,
          startTime: i.startTime,
          endTime: i.endTime,
        }));
        const reorder = await fetch(`/api/admin/events/${event.id}/agenda/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
        if (!reorder.ok) throw new Error(`HTTP ${reorder.status}`);
      } catch (err) {
        console.error("Reorder after insert failed:", err);
        toast.error(
          "Inserted item but failed to shift later items",
          err instanceof Error ? err.message : String(err),
        );
      }
    } catch (err) {
      console.error("Failed to add item:", err);
      toast.error("Failed to add agenda item", err instanceof Error ? err.message : String(err));
    }
  };

  const openInsertDefaults = () => {
    setShowAddMenu(false);
    if (items.length > 0) {
      setDefaultsConfirmOpen(true);
    } else {
      void runInsertDefaults();
    }
  };

  const runInsertDefaults = async () => {
    setDefaultsConfirmOpen(false);
    const anchor = event.startTime ? new Date(event.startTime) : null;
    if (!anchor || Number.isNaN(anchor.getTime())) {
      toast.error("Event has no valid start time");
      return;
    }
    setDefaultsInserting(true);
    try {
      for (const slot of buildDefaultAgenda(countryName)) {
        const body = {
          type: slot.type,
          title: slot.title,
          description: slot.description ?? null,
          startTime: new Date(anchor.getTime() + slot.offsetMin * 60_000).toISOString(),
          endTime: new Date(
            anchor.getTime() + (slot.offsetMin + slot.durationMin) * 60_000,
          ).toISOString(),
        };
        const res = await fetch(`/api/admin/events/${event.id}/agenda`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      const refresh = await fetch(`/api/admin/events/${event.id}/agenda`);
      if (refresh.ok) {
        const data = (await refresh.json()) as AgendaItem[];
        setItems(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to insert default agenda:", err);
      toast.error(
        "Failed to insert default agenda",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setDefaultsInserting(false);
    }
  };

  const removeItem = async (id: string) => {
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/agenda/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Failed to remove:", err);
      setItems(prev);
      toast.error("Failed to delete agenda item", err instanceof Error ? err.message : String(err));
    }
  };

  const updateItem = async (id: string, patch: Partial<AgendaItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      const res = await fetch(`/api/admin/events/${event.id}/agenda/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as AgendaItem;
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      console.error("Failed to update:", err);
      toast.error("Failed to save changes", err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Edit an item's end time, then shift every later item by the same delta so
   * the user doesn't have to bump times one by one. Items with null start/end
   * are left untouched. The first item with a valid endTime is the only one
   * that anchors the delta calculation — if the edited item had no prior end
   * time we just set it and don't cascade.
   */
  const updateEndTimeWithCascade = async (id: string, newEndIso: string | null) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const oldEnd = items[idx].endTime;
    const oldMs = oldEnd ? new Date(oldEnd).getTime() : NaN;
    const newMs = newEndIso ? new Date(newEndIso).getTime() : NaN;
    // No anchor or clearing the value → just set this item's end, no cascade.
    if (!Number.isFinite(oldMs) || !Number.isFinite(newMs)) {
      await updateItem(id, { endTime: newEndIso });
      return;
    }
    const delta = newMs - oldMs;
    if (delta === 0) return;

    const shift = (iso: string) => new Date(new Date(iso).getTime() + delta).toISOString();
    const next = items.map((i, j) => {
      if (j === idx) return { ...i, endTime: newEndIso };
      if (j > idx && i.startTime && i.endTime) {
        return { ...i, startTime: shift(i.startTime), endTime: shift(i.endTime) };
      }
      return i;
    });

    // Reorder endpoint requires the full list — submit every item in current
    // order, with the shifted times where applicable.
    const entries = next.map((i) => ({
      id: i.id,
      startTime: i.startTime,
      endTime: i.endTime,
    }));

    const prev = items;
    setItems(next);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/agenda/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${detail}`);
      }
    } catch (err) {
      console.error("Cascade save failed:", err);
      setItems(prev);
      toast.error("Failed to shift later items", err instanceof Error ? err.message : String(err));
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Times stay anchored to the position — item at new index N takes the
    // start/end that was at position N before the reorder.
    const slotTimes = items.map((i) => ({ startTime: i.startTime, endTime: i.endTime }));
    const moved = arrayMove(items, oldIndex, newIndex);
    const next = moved.map((i, idx) => ({
      ...i,
      order: idx,
      startTime: slotTimes[idx]?.startTime ?? null,
      endTime: slotTimes[idx]?.endTime ?? null,
    }));
    const prev = items;
    setItems(next);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/agenda/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: next.map((i) => ({
            id: i.id,
            startTime: i.startTime,
            endTime: i.endTime,
          })),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${detail}`);
      }
    } catch (err) {
      console.error("Reorder failed:", err);
      setItems(prev);
      toast.error("Failed to reorder", err instanceof Error ? err.message : String(err));
    }
  };

  const toggleActive = async (next: boolean) => {
    const prev = event.isActive ?? true;
    onEventUpdate({ isActive: next });
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Failed to toggle active:", err);
      onEventUpdate({ isActive: prev });
      toast.error(
        "Failed to update active status",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const saveHeaderFooter = async () => {
    setHeaderFooterSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headerText, footerText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onEventUpdate({ headerText, footerText });
    } catch (err) {
      console.error("Failed to save header/footer:", err);
      toast.error(
        "Failed to save intro / footer",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setHeaderFooterSaving(false);
    }
  };

  // Regenerate blast when inputs change, unless user edited the draft manually.
  useEffect(() => {
    if (blastDirty) return;
    setBlastDraft(
      renderBlast(
        {
          title: event.title,
          startTime: event.startTime,
          timezone: event.timezone,
          location: event.location ?? null,
          feedbackUrl,
        },
        blastKind,
        { lang, siteUrl },
      ),
    );
  }, [
    blastKind,
    event.title,
    event.startTime,
    event.timezone,
    event.location,
    feedbackUrl,
    blastDirty,
    lang,
    siteUrl,
  ]);

  const regenerateBlast = () => {
    setBlastDirty(false);
    setBlastDraft(
      renderBlast(
        {
          title: event.title,
          startTime: event.startTime,
          timezone: event.timezone,
          location: event.location ?? null,
          feedbackUrl,
        },
        blastKind,
        { lang, siteUrl },
      ),
    );
  };

  const copyBlast = async () => {
    await navigator.clipboard.writeText(blastDraft);
    setBlastCopied(true);
    setTimeout(() => setBlastCopied(false), 1500);
  };

  const saveFeedbackUrl = async () => {
    setFeedbackSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onEventUpdate({ feedbackUrl });
    } catch (err) {
      console.error("Failed to save feedback URL:", err);
      toast.error("Failed to save feedback URL", err instanceof Error ? err.message : String(err));
    } finally {
      setFeedbackSaving(false);
    }
  };

  const description = useMemo(
    () =>
      renderDescription(
        { headerText, footerText, agenda: items, timezone: event.timezone },
        descFormat,
        lang,
      ),
    [headerText, footerText, items, event.timezone, descFormat, lang],
  );

  // The description shown on public event pages — kept in sync automatically.
  // Markdown is always persisted so LessonContent can render headings/links.
  const persistedDescription = useMemo(
    () =>
      renderDescription(
        { headerText, footerText, agenda: items, timezone: event.timezone },
        "markdown",
        lang,
      ),
    [headerText, footerText, items, event.timezone, lang],
  );

  // Autosave the generated description to the event whenever it changes.
  // Skip until the first agenda load completes so we don't clobber server
  // state with an empty render on mount. Debounced to avoid spamming on
  // every keystroke when the user edits header/footer text.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      void fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: persistedDescription }),
      }).catch((err) => console.error("Failed to autosave description:", err));
    }, 800);
    return () => clearTimeout(t);
  }, [persistedDescription, loading, event.id]);

  const copyDescription = async () => {
    await navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1f1f1f] rounded-xl w-full max-w-7xl h-[92vh] flex flex-col border border-[#333]">
        <div className="px-6 py-4 border-b border-[#333] flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">Prepare event</h2>
            <p className="text-sm text-gray-400 truncate">{event.title}</p>
          </div>
          <div className="flex items-center gap-1 bg-[#2a2a2a] border border-[#444] rounded-lg p-0.5 mr-3">
            <button
              type="button"
              onClick={() => setTab("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "details" ? "bg-[#E07A5F] text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Details
            </button>
            <button
              type="button"
              onClick={() => setTab("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "agenda" ? "bg-[#E07A5F] text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Agenda &amp; Description
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("speakers");
                void refreshSpeakers();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "speakers" ? "bg-[#E07A5F] text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Speakers
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("slides");
                void refreshSpeakers();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "slides" ? "bg-[#E07A5F] text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              Slide Generator
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {tab === "details" ? (
          <EventDetailsTab
            initial={
              {
                id: event.id,
                title: event.title,
                city: event.city ?? null,
                location: event.location ?? null,
                timezone: event.timezone,
                eventType: event.eventType ?? "meetup",
                startTime: event.startTime,
                maxAttendees: event.maxAttendees ?? null,
                isOnline: event.isOnline ?? false,
                meetingUrl: event.meetingUrl ?? null,
                lumaUrl: event.lumaUrl ?? null,
                imageUrl: event.imageUrl ?? null,
                rsvpEnabled: event.rsvpEnabled ?? false,
              } as EventDetails
            }
            isActive={event.isActive ?? true}
            onToggleActive={(next) => void toggleActive(next)}
            generatedDescription={description}
            onSaved={(saved) =>
              onEventUpdate({
                title: saved.title,
                city: saved.city,
                location: saved.location,
                timezone: saved.timezone,
                eventType: saved.eventType,
                startTime: saved.startTime,
                maxAttendees: saved.maxAttendees,
                isOnline: saved.isOnline,
                meetingUrl: saved.meetingUrl,
                lumaUrl: saved.lumaUrl,
                imageUrl: saved.imageUrl,
                rsvpEnabled: saved.rsvpEnabled,
              })
            }
          />
        ) : tab === "slides" ? (
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <SpeakerSlideGenerator
              scope={`event:${event.id}`}
              externalSpeakers={slideSpeakers}
              defaultHeaderText={event.title}
              defaultEventDate={isoToSlideDate(event.startTime, event.timezone)}
              filenameSlug={`${
                (event.title || "event")
                  .replace(/\s+/g, "_")
                  .replace(/[^a-zA-Z0-9_-]/g, "")
                  .slice(0, 40) || "event"
              }_slide`}
            />
          </div>
        ) : tab === "speakers" ? (
          <SpeakersPanel eventId={event.id} />
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-0 overflow-hidden">
            {/* Agenda list */}
            <div className="col-span-4 border-r border-[#333] flex flex-col min-h-0">
              <div className="p-4 border-b border-[#333] flex items-center justify-between relative flex-shrink-0">
                <h3 className="text-white font-medium">Agenda</h3>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddMenu((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E07A5F] hover:bg-[#c96a52] text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                  {showAddMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#2a2a2a] border border-[#444] rounded-lg shadow-xl z-10">
                      <button
                        type="button"
                        onClick={() => addItem("speaker")}
                        className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333] flex items-center gap-2"
                      >
                        <Mic className="w-4 h-4 text-[#E07A5F]" /> Add speaker
                      </button>
                      <button
                        type="button"
                        onClick={() => addItem("welcome")}
                        className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333] flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-yellow-400" /> Add welcome
                      </button>
                      <button
                        type="button"
                        onClick={() => addItem("break")}
                        className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333] flex items-center gap-2"
                      >
                        <Coffee className="w-4 h-4 text-blue-400" /> Add break
                      </button>
                      <button
                        type="button"
                        onClick={() => addItem("custom")}
                        className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333] flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4 text-gray-400" /> Add custom slot
                      </button>
                      <div className="border-t border-[#444] my-1" />
                      <button
                        type="button"
                        onClick={openInsertDefaults}
                        disabled={defaultsInserting}
                        className="w-full text-left px-3 py-2 text-gray-200 hover:bg-[#333] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {defaultsInserting ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 text-emerald-400" />
                        )}
                        {defaultsInserting
                          ? "Inserting default template…"
                          : "Insert default template"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : defaultsInserting ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Inserting default agenda…</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 text-sm space-y-3">
                    <p>
                      No agenda items yet. Click <span className="text-[#E07A5F]">+ Add</span> to
                      start.
                    </p>
                    <button
                      type="button"
                      onClick={openInsertDefaults}
                      disabled={defaultsInserting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Insert default template
                    </button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                  >
                    <SortableContext
                      items={items.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {items.map((item) => (
                          <SortableRow
                            key={item.id}
                            item={item}
                            selected={selectedId === item.id}
                            onSelect={() => setSelectedId(item.id)}
                            onDelete={() => setDeleteTarget(item)}
                            onResize={(iso) => updateEndTimeWithCascade(item.id, iso)}
                            onResizePreview={(deltaMs) =>
                              setResizePreview(
                                deltaMs == null ? null : { itemId: item.id, deltaMs },
                              )
                            }
                            previewItem={resizePreviewMap?.[item.id]}
                            timezone={event.timezone}
                            speakers={speakers}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>

            {/* Edit pane + description */}
            <div className="col-span-8 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto">
                {selected ? (
                  <ItemEditor
                    key={selected.id}
                    item={selected}
                    onChange={(patch) => updateItem(selected.id, patch)}
                    onEndTimeChange={(iso) => updateEndTimeWithCascade(selected.id, iso)}
                    eventSpeakers={speakers}
                    eventId={event.id}
                    onGoToSpeakersTab={() => setTab("speakers")}
                  />
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Select an agenda item to edit, or add one to get started.
                  </div>
                )}

                {/* Header / footer */}
                <div className="p-4 border-t border-[#333] space-y-3">
                  <h4 className="text-white font-medium text-sm">Description intro & footer</h4>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="prep-intro-paragraph" className="block text-xs text-gray-400">
                        Intro paragraph
                      </label>
                      <button
                        type="button"
                        onClick={() => setHeaderText(buildDefaultHeader(communityName))}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Use default
                      </button>
                    </div>
                    <textarea
                      id="prep-intro-paragraph"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      rows={3}
                      className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                      placeholder={`e.g. ${communityName} is excited to host…`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="prep-footer" className="block text-xs text-gray-400">
                        Footer
                      </label>
                      <button
                        type="button"
                        onClick={() => setFooterText(DEFAULT_FOOTER)}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Use default
                      </button>
                    </div>
                    <textarea
                      id="prep-footer"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      rows={3}
                      className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                      placeholder="e.g. What is Claude Code? … Photography disclaimer…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveHeaderFooter}
                    disabled={headerFooterSaving}
                    className="px-3 py-1.5 bg-[#444] hover:bg-[#555] text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {headerFooterSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save intro / footer
                  </button>
                </div>

                {/* Description generator */}
                <div className="p-4 border-t border-[#333]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-medium text-sm">Generated description</h4>
                    <div className="flex items-center gap-2">
                      <div className="bg-[#2a2a2a] border border-[#444] rounded-lg p-0.5 flex text-xs">
                        <button
                          type="button"
                          onClick={() => setDescFormat("plain")}
                          className={`px-2 py-1 rounded ${descFormat === "plain" ? "bg-[#E07A5F] text-white" : "text-gray-400"}`}
                        >
                          Plain text
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescFormat("markdown")}
                          className={`px-2 py-1 rounded ${descFormat === "markdown" ? "bg-[#E07A5F] text-white" : "text-gray-400"}`}
                        >
                          Markdown
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={copyDescription}
                        className="px-3 py-1.5 bg-[#E07A5F] hover:bg-[#c96a52] text-white text-sm rounded-lg flex items-center gap-1.5"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <pre className="bg-[#2a2a2a] border border-[#444] rounded-lg p-3 text-xs text-gray-200 whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                    {description || "(empty — add agenda items)"}
                  </pre>
                </div>

                {/* Claudience */}
                <ClaudienceSection
                  event={event}
                  onProvisioned={(patch) => {
                    onEventUpdate(patch);
                    if (patch.feedbackUrl) setFeedbackUrl(patch.feedbackUrl);
                  }}
                />

                {/* Email blasts */}
                <div className="p-4 border-t border-[#333] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-medium text-sm">Email blasts (Luma)</h4>
                    <div className="bg-[#2a2a2a] border border-[#444] rounded-lg p-0.5 flex text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setBlastKind("morning-of");
                          setBlastDirty(false);
                        }}
                        className={`px-2 py-1 rounded ${blastKind === "morning-of" ? "bg-[#E07A5F] text-white" : "text-gray-400"}`}
                      >
                        Morning of
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBlastKind("post-event");
                          setBlastDirty(false);
                        }}
                        className={`px-2 py-1 rounded ${blastKind === "post-event" ? "bg-[#E07A5F] text-white" : "text-gray-400"}`}
                      >
                        Post-event
                      </button>
                    </div>
                  </div>

                  {blastKind === "post-event" && (
                    <div>
                      <label
                        htmlFor="prep-feedback-url"
                        className="block text-xs text-gray-400 mb-1"
                      >
                        Feedback survey URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="prep-feedback-url"
                          type="url"
                          value={feedbackUrl}
                          onChange={(e) => setFeedbackUrl(e.target.value)}
                          placeholder="https://claudience.com/s/…/survey/…"
                          className="flex-1 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                        />
                        <button
                          type="button"
                          onClick={saveFeedbackUrl}
                          disabled={feedbackSaving}
                          className="px-3 py-1.5 bg-[#444] hover:bg-[#555] text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {feedbackSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">
                        {blastDirty ? "Edited" : "Auto-generated"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={regenerateBlast}
                          className="text-xs text-gray-400 hover:text-white"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={copyBlast}
                          className="px-3 py-1.5 bg-[#E07A5F] hover:bg-[#c96a52] text-white text-sm rounded-lg flex items-center gap-1.5"
                        >
                          {blastCopied ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {blastCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={14}
                      value={blastDraft}
                      onChange={(e) => {
                        setBlastDraft(e.target.value);
                        setBlastDirty(true);
                      }}
                      className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-3 text-xs text-gray-200 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={defaultsConfirmOpen}
        title="Append default template?"
        description="The 8-slot meetup template will be appended to the existing agenda items, anchored to the event's start time."
        confirmLabel="Append"
        onCancel={() => setDefaultsConfirmOpen(false)}
        onConfirm={async () => {
          await runInsertDefaults();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        variant="destructive"
        title="Remove agenda item?"
        description={
          deleteTarget
            ? `"${
                deleteTarget.type === "speaker"
                  ? deleteTarget.title || "Speaker"
                  : deleteTarget.title || deleteTarget.type
              }" will be permanently removed.`
            : undefined
        }
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await removeItem(id);
        }}
      />
    </div>
  );
}

// Pixels of vertical drag per minute of duration change. 2 px/min keeps drag
// feel snappy without making fine adjustments impossible.
const RESIZE_PX_PER_MIN = 2;
const RESIZE_SNAP_MIN = 5;
const RESIZE_MIN_DURATION_MIN = 5;

function formatTimeOnly(iso: string | null, tz: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz || undefined,
    });
  } catch {
    return d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
}

function SortableRow({
  item,
  selected,
  onSelect,
  onDelete,
  onResize,
  onResizePreview,
  previewItem,
  timezone,
  speakers,
}: {
  item: AgendaItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onResize: (newEndIso: string) => void;
  /** Push the live drag delta (ms) up to the parent so it can shift all later
   *  rows; pass `null` to clear the preview on release/cancel. */
  onResizePreview: (deltaMs: number | null) => void;
  /** Parent-supplied preview override: when set, render this row's times from
   *  here (and in red) instead of the canonical `item`. */
  previewItem?: AgendaItem;
  timezone: string | null;
  speakers: EventSpeaker[];
}) {
  const { lang } = useTenantConfig();
  const liveSpeakerName =
    item.type === "speaker" && item.speakerId
      ? (speakers.find((s) => s.id === item.speakerId)?.name ?? item.speaker?.name ?? null)
      : null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = TYPE_META[(item.type as AgendaType) || "custom"] || TYPE_META.custom;
  const Icon = meta.icon;

  // `lastDeltaMs` is updated on every pointermove; on pointerup we use it to
  // decide whether to commit and what end time to send.
  const resizeStateRef = useRef<{
    startY: number;
    startMs: number;
    startEndMs: number;
    startDurationMin: number;
    pointerId: number;
    lastDeltaMs: number;
  } | null>(null);
  const [isPressingHandle, setIsPressingHandle] = useState(false);

  const canResize = !!(item.startTime && item.endTime);
  const showPreview = !!previewItem;
  const displayItem = previewItem ?? item;
  const timeLabel = formatRowTime(displayItem, timezone, lang);

  // Duration of the dragger row, derived from the preview times when present.
  const dragPreviewDurationMin =
    isPressingHandle && previewItem?.startTime && previewItem?.endTime
      ? Math.round(
          (new Date(previewItem.endTime).getTime() - new Date(previewItem.startTime).getTime()) /
            60_000,
        )
      : null;

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!item.startTime || !item.endTime) return;
    const startMs = new Date(item.startTime).getTime();
    const endMs = new Date(item.endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startDurationMin = Math.max(
      RESIZE_MIN_DURATION_MIN,
      Math.round((endMs - startMs) / 60_000),
    );
    resizeStateRef.current = {
      startY: e.clientY,
      startMs,
      startEndMs: endMs,
      startDurationMin,
      pointerId: e.pointerId,
      lastDeltaMs: 0,
    };
    setIsPressingHandle(true);
    onResizePreview(0);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state) return;
    const dy = e.clientY - state.startY;
    const raw = state.startDurationMin + dy / RESIZE_PX_PER_MIN;
    const snapped = Math.max(
      RESIZE_MIN_DURATION_MIN,
      Math.round(raw / RESIZE_SNAP_MIN) * RESIZE_SNAP_MIN,
    );
    const newEndMs = state.startMs + snapped * 60_000;
    const deltaMs = newEndMs - state.startEndMs;
    state.lastDeltaMs = deltaMs;
    onResizePreview(deltaMs);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeStateRef.current;
    if (!state) {
      setIsPressingHandle(false);
      onResizePreview(null);
      return;
    }
    try {
      e.currentTarget.releasePointerCapture(state.pointerId);
    } catch {
      // pointer may have already been released by the browser
    }
    const deltaMs = state.lastDeltaMs;
    resizeStateRef.current = null;
    setIsPressingHandle(false);
    onResizePreview(null);
    if (deltaMs !== 0) {
      const newEndMs = state.startEndMs + deltaMs;
      onResize(new Date(newEndMs).toISOString());
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-[#2a2a2a] rounded-lg border ${selected ? "border-[#E07A5F]" : "border-[#333]"} flex items-stretch group`}
    >
      <button
        type="button"
        className="px-2 cursor-grab text-gray-500 hover:text-white flex items-center"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex-1 text-left py-2 pr-2 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
          <span className="text-white text-sm truncate">
            {item.type === "speaker"
              ? liveSpeakerName || item.title || "Speaker"
              : item.title || meta.label}
          </span>
        </div>
        {(timeLabel || item.title) && (
          <div className="text-xs mt-0.5 truncate">
            <span className={showPreview ? "text-red-400 font-semibold" : "text-gray-500"}>
              {timeLabel}
            </span>
            <span className="text-gray-500">
              {timeLabel && item.type === "speaker" && item.title ? " · " : ""}
              {item.type === "speaker" ? item.title : ""}
            </span>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {canResize && (
        <div
          aria-hidden="true"
          title="Drag to change duration"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          style={{ touchAction: "none" }}
          className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-12 h-3 flex items-center justify-center cursor-ns-resize select-none z-10 transition-opacity ${
            isPressingHandle ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div
            className={`w-8 h-1 rounded-full ${isPressingHandle ? "bg-[#E07A5F]" : "bg-gray-500"}`}
          />
        </div>
      )}

      {isPressingHandle && previewItem?.endTime && dragPreviewDurationMin != null && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-7 bg-[#E07A5F] text-white text-[11px] font-medium px-2 py-0.5 rounded shadow-lg z-20 whitespace-nowrap pointer-events-none">
          ends {formatTimeOnly(previewItem.endTime, timezone, lang)} · {dragPreviewDurationMin} min
        </div>
      )}
    </div>
  );
}

function formatRowTime(item: AgendaItem, tz: string | null, lang: string): string {
  const fmt = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleTimeString(lang, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: tz || undefined,
      });
    } catch {
      return d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  };
  const s = fmt(item.startTime);
  const e = fmt(item.endTime);
  if (s && e) return `${s}–${e}`;
  return s;
}

function ItemEditor({
  item,
  onChange,
  onEndTimeChange,
  eventSpeakers,
  eventId,
  onGoToSpeakersTab,
}: {
  item: AgendaItem;
  onChange: (patch: Partial<AgendaItem>) => void;
  onEndTimeChange: (iso: string | null) => void;
  eventSpeakers: EventSpeaker[];
  eventId: string;
  onGoToSpeakersTab: () => void;
}) {
  const type = (item.type as AgendaType) || "custom";
  const meta = TYPE_META[type] || TYPE_META.custom;
  const [previewDescription, setPreviewDescription] = useState(false);

  // Local controlled values for snappier typing; flush on blur.
  const [title, setTitle] = useState(item.title || "");
  const [description, setDescription] = useState(item.description || "");
  // biome-ignore lint/correctness/useExhaustiveDependencies: item.id is an intentional trigger to re-sync local title/description when the agenda item identity changes.
  useEffect(() => {
    setTitle(item.title || "");
    setDescription(item.description || "");
  }, [item.id, item.title, item.description]);

  const linkedSpeaker = item.speakerId
    ? (eventSpeakers.find((s) => s.id === item.speakerId) ?? null)
    : null;

  const flushIfChanged = useCallback(
    <K extends keyof AgendaItem>(key: K, value: AgendaItem[K]) => {
      if ((item[key] ?? "") !== (value ?? "")) onChange({ [key]: value } as Partial<AgendaItem>);
    },
    [item, onChange],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <meta.icon className={`w-5 h-5 ${meta.color}`} />
        <h3 className="text-white font-semibold">{meta.label}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prep-item-start" className="block text-xs text-gray-400 mb-1">
            Start
          </label>
          <input
            id="prep-item-start"
            type="datetime-local"
            value={isoToLocalInput(item.startTime)}
            onChange={(e) => onChange({ startTime: localInputToIso(e.target.value) })}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
          />
        </div>
        <div>
          <label htmlFor="prep-item-end" className="block text-xs text-gray-400 mb-1">
            End
          </label>
          <input
            id="prep-item-end"
            type="datetime-local"
            value={isoToLocalInput(item.endTime)}
            onChange={(e) => onEndTimeChange(localInputToIso(e.target.value))}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Changing this shifts all later items by the same amount.
          </p>
        </div>
      </div>

      {type === "speaker" ? (
        <SpeakerSlotPicker
          item={item}
          linkedSpeaker={linkedSpeaker}
          eventSpeakers={eventSpeakers}
          eventId={eventId}
          onChange={onChange}
          onGoToSpeakersTab={onGoToSpeakersTab}
        />
      ) : (
        <div>
          <label htmlFor="prep-item-title" className="block text-xs text-gray-400 mb-1">
            Title
          </label>
          <input
            id="prep-item-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => flushIfChanged("title", title)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
            placeholder="Slot title"
          />
        </div>
      )}

      {type !== "speaker" && (
        <MarkdownField
          label="Description (markdown)"
          value={description}
          onValue={setDescription}
          onCommit={() => flushIfChanged("description", description)}
          preview={previewDescription}
          onTogglePreview={() => setPreviewDescription((v) => !v)}
          rows={6}
        />
      )}
    </div>
  );
}

function MarkdownField({
  label,
  value,
  onValue,
  onCommit,
  preview,
  onTogglePreview,
  rows,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  onCommit: () => void;
  preview: boolean;
  onTogglePreview: () => void;
  rows: number;
}) {
  const fieldId = useId();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={fieldId} className="block text-xs text-gray-400">
          {label}
        </label>
        <button
          type="button"
          onClick={onTogglePreview}
          className="text-xs text-[#E07A5F] hover:underline"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div
          className="bg-[#2a2a2a] border border-[#444] rounded-lg p-3 text-sm min-h-[6rem] space-y-2"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: input is escaped in renderMarkdownPreview
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(value) }}
        />
      ) : (
        <textarea
          id={fieldId}
          rows={rows}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          onBlur={onCommit}
          className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white font-mono"
          placeholder="Markdown supported: **bold**, _italic_, [link](https://…), # headings, - lists"
        />
      )}
    </div>
  );
}

function SpeakerSlotPicker({
  item,
  linkedSpeaker,
  eventSpeakers,
  eventId,
  onChange,
  onGoToSpeakersTab,
}: {
  item: AgendaItem;
  linkedSpeaker: EventSpeaker | null;
  eventSpeakers: EventSpeaker[];
  eventId: string;
  onChange: (patch: Partial<AgendaItem>) => void;
  onGoToSpeakersTab: () => void;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const handleSelect = (value: string) => {
    if (value === "__new__") {
      void createBlankSpeaker();
      return;
    }
    onChange({ speakerId: value || null });
  };

  const createBlankSpeaker = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New speaker",
          talkTitle: item.title ?? null,
          talkDescription: item.description ?? null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `${res.status} ${res.statusText}`);
      }
      const created = (await res.json()) as EventSpeaker;
      onChange({ speakerId: created.id });
      onGoToSpeakersTab();
    } catch (err) {
      console.error("Failed to create speaker:", err);
      toast.error("Failed to create speaker", err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 space-y-3">
      <div>
        <label htmlFor="prep-speaker-select" className="block text-xs text-gray-400 mb-1">
          Speaker
        </label>
        <div className="flex gap-2">
          <select
            id="prep-speaker-select"
            value={item.speakerId ?? ""}
            onChange={(e) => handleSelect(e.target.value)}
            className="flex-1 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
          >
            <option value="">— None —</option>
            {eventSpeakers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.talkTitle ? ` · ${s.talkTitle}` : ""}
              </option>
            ))}
            <option disabled>──────────</option>
            <option value="__new__">+ Create new speaker</option>
          </select>
          <button
            type="button"
            onClick={onGoToSpeakersTab}
            className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-gray-300 hover:text-white rounded-lg text-xs"
            title="Open the Speakers tab to edit details"
          >
            Manage
          </button>
        </div>
        {creating && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Creating…
          </div>
        )}
      </div>

      {linkedSpeaker && (
        <div className="flex items-start gap-3 bg-[#2a2a2a] border border-[#333] rounded-lg p-2.5">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-[#333] shrink-0 flex items-center justify-center">
            {linkedSpeaker.headshotUrl ? (
              <Image
                src={linkedSpeaker.headshotUrl}
                alt={linkedSpeaker.name}
                width={56}
                height={56}
                className="object-cover w-full h-full"
              />
            ) : (
              <Mic className="w-4 h-4 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{linkedSpeaker.name}</div>
            <div className="text-xs text-gray-400 truncate">
              {linkedSpeaker.talkTitle || "No talk title set"}
            </div>
            {[linkedSpeaker.title, linkedSpeaker.company].filter(Boolean).length > 0 && (
              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                {[linkedSpeaker.title, linkedSpeaker.company].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onGoToSpeakersTab}
            className="px-2 py-1 text-xs text-[#E07A5F] hover:underline shrink-0"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
