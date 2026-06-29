"use client";

import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Copy as CopyIcon,
  Download,
  Edit3,
  FileImage,
  Layers,
  Loader2,
  Minus,
  Move,
  Plus,
  Settings2,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import { useToast } from "@/components/ui/Toast";
import { downloadDataURL, downloadDataURLsAsZip, renderSlideToDataURL } from "./canvasExport";
import DraggableSlideEditor from "./DraggableSlideEditor";
import { defaultSlideTemplate } from "./defaults";
import { type ExportProgress, runExport } from "./exportClient";
import {
  createPreset as apiCreatePreset,
  deletePreset as apiDeletePreset,
  fetchPresets,
  fetchState,
  type SlideEntry,
  type SlidePreset,
  type StoredStateV1,
  type StoredStateV2,
  saveState,
} from "./persistence";
import { SlideImage } from "./SlideImage";
import SlideUiPreview from "./SlidePreview";
import SpeakerEditModal from "./SpeakerEditModal";
import TemplatePanel from "./TemplatePanel";
import { ASPECT_RATIOS, type SeedSpeaker, type SlideSpeaker, type SlideTemplate } from "./types";

/** Editor zoom bounds (1 = 100%). */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

type SidebarTab = "template" | "speakers";

interface SpeakerSlideGeneratorProps {
  /**
   * Persistence key. Use `"global"` for the standalone admin tool, or
   * `"event:<eventId>"` to scope per event.
   */
  scope: string;

  /**
   * Pre-fills speakers when no server state exists yet (e.g. from agenda items).
   * Each seed has a stable `sourceId` so repeated calls won't duplicate.
   * Ignored when `externalSpeakers` is provided.
   */
  seedSpeakers?: SeedSpeaker[];

  /**
   * Canonical speakers list (per-event Speaker rows). When provided, the
   * generator skips its internal speaker editing UI and renders these
   * directly. Edits happen in the Speakers tab.
   */
  externalSpeakers?: SlideSpeaker[];

  /** Default value for `template.header_text` on first run. */
  defaultHeaderText?: string;

  /**
   * Default value for `template.event_date` (YYYY-MM-DD). Applied on first run
   * and back-filled into any saved slide whose event_date is still null. Lets
   * the event-scoped generator pre-populate the date the user already set on
   * the event without overwriting a date they typed manually.
   */
  defaultEventDate?: string | null;

  /** Slug used for the export filename prefix. Falls back to "slides". */
  filenameSlug?: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * The textBlock element was split into independent name / subtitle / talk /
 * social slots. Templates saved before that change carry their custom
 * `textBlock` position in elementPositions; this function distributes it
 * across the four new slots so the user's prior layout work isn't lost.
 * Idempotent — no-op once the textBlock field is gone.
 */
function migrateTextBlockSplit(t: SlideTemplate): SlideTemplate {
  const ep = t.layout_config.elementPositions;
  const legacy = ep?.textBlock;
  if (!ep || !legacy) return t;
  const stacked = (offsetY: number) => ({
    x: legacy.x,
    y: legacy.y + offsetY,
    scale: legacy.scale,
  });
  const { textBlock: _legacy, ...rest } = ep;
  const next: SlideTemplate["layout_config"]["elementPositions"] = {
    ...rest,
    name: ep.name ?? stacked(0),
    subtitle: ep.subtitle ?? stacked(8),
    talk: ep.talk ?? stacked(14),
    social: ep.social ?? stacked(24),
  };
  return {
    ...t,
    layout_config: { ...t.layout_config, elementPositions: next },
  };
}

function mergeTemplate(t: SlideTemplate): SlideTemplate {
  return migrateTextBlockSplit({ ...defaultSlideTemplate(), ...t });
}

function isV2(s: StoredStateV1 | StoredStateV2 | null | undefined): s is StoredStateV2 {
  return !!s && (s as StoredStateV2).version === 2 && Array.isArray((s as StoredStateV2).slides);
}

function migrateState(
  existing: StoredStateV1 | StoredStateV2 | null,
  defaultHeaderText: string | undefined,
  defaultEventDate: string | null | undefined,
): StoredStateV2 {
  const applyDateDefault = (t: SlideTemplate): SlideTemplate =>
    defaultEventDate && !t.event_date ? { ...t, event_date: defaultEventDate } : t;

  if (isV2(existing)) {
    return {
      version: 2,
      slides: existing.slides.map((s) => ({
        id: s.id || randomId(),
        label: s.label || s.template.aspect_ratio,
        template: applyDateDefault(mergeTemplate(s.template)),
      })),
      speakers: existing.speakers,
      seededIds: existing.seededIds,
    };
  }
  if (existing && (existing as StoredStateV1).template) {
    const v1 = existing as StoredStateV1;
    const merged = applyDateDefault(mergeTemplate(v1.template));
    return {
      version: 2,
      slides: [{ id: randomId(), label: merged.aspect_ratio, template: merged }],
      speakers: v1.speakers,
      seededIds: v1.seededIds,
    };
  }
  const fresh = defaultSlideTemplate();
  if (defaultHeaderText) fresh.header_text = defaultHeaderText;
  if (defaultEventDate) fresh.event_date = defaultEventDate;
  return {
    version: 2,
    slides: [{ id: randomId(), label: fresh.aspect_ratio, template: fresh }],
    speakers: [],
    seededIds: [],
  };
}

function seedToSpeaker(seed: SeedSpeaker): SlideSpeaker {
  return {
    id: seed.sourceId,
    name: seed.name,
    title: null,
    company: null,
    talk_title: seed.talk_title ?? null,
    talk_description: seed.bio ?? null,
    headshot_url: seed.headshot_url ?? null,
    company_logo_url: null,
    twitter_handle: null,
    linkedin_url: null,
    website_url: null,
  };
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function SpeakerSlideGenerator({
  scope,
  seedSpeakers,
  externalSpeakers,
  defaultHeaderText,
  defaultEventDate,
  filenameSlug = "slides",
}: SpeakerSlideGeneratorProps) {
  const toast = useToast();
  const isExternalSpeakers = externalSpeakers !== undefined;

  const [slides, setSlides] = useState<SlideEntry[]>(() => {
    const t = defaultSlideTemplate();
    if (defaultHeaderText) t.header_text = defaultHeaderText;
    if (defaultEventDate) t.event_date = defaultEventDate;
    return [{ id: randomId(), label: t.aspect_ratio, template: t }];
  });
  const [selectedSlideId, setSelectedSlideId] = useState<string>(() => "");
  const [internalSpeakers, setInternalSpeakers] = useState<SlideSpeaker[]>([]);
  const [seededIds, setSeededIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  // Latest pending payload — set by the autosave effect, cleared once it
  // lands. Used by `flushPendingSave` so a Download click can force a sync
  // save before the server-side renderer reads stale state.
  const pendingSaveRef = useRef<StoredStateV2 | null>(null);

  // Resolved speaker list — external takes precedence.
  const speakers = isExternalSpeakers ? (externalSpeakers ?? []) : internalSpeakers;

  // Load server state on mount / scope change.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadError(null);
    fetchState(scope)
      .then((existing) => {
        if (cancelled) return;
        const payload = migrateState(existing, defaultHeaderText, defaultEventDate);
        setSlides(payload.slides);
        setSelectedSlideId(payload.slides[0]?.id ?? "");
        setInternalSpeakers(payload.speakers ?? []);
        setSeededIds(payload.seededIds ?? []);
        lastSavedRef.current = JSON.stringify(payload);
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error("Slide generator load failed:", err);
        setLoadError(err.message);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, defaultHeaderText, defaultEventDate]);

  // Merge in new seed speakers we haven't seen before (only after load, and only when speakers are internal).
  useEffect(() => {
    if (!loaded || isExternalSpeakers) return;
    if (!seedSpeakers || seedSpeakers.length === 0) return;
    const known = new Set(seededIds);
    const novel = seedSpeakers.filter((s) => !known.has(s.sourceId));
    if (novel.length === 0) return;
    setInternalSpeakers((prev) => [...prev, ...novel.map(seedToSpeaker)]);
    setSeededIds((prev) => [...prev, ...novel.map((s) => s.sourceId)]);
  }, [loaded, seedSpeakers, seededIds, isExternalSpeakers]);

  const resyncFromSeed = useCallback(() => {
    if (!seedSpeakers || seedSpeakers.length === 0) return;
    setInternalSpeakers((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s] as const));
      for (const seed of seedSpeakers) {
        const existing = byId.get(seed.sourceId);
        const fresh = seedToSpeaker(seed);
        if (existing) {
          byId.set(seed.sourceId, {
            ...existing,
            name: fresh.name,
            talk_title: fresh.talk_title ?? existing.talk_title ?? null,
            talk_description: fresh.talk_description ?? existing.talk_description ?? null,
            headshot_url: fresh.headshot_url ?? existing.headshot_url ?? null,
          });
        } else {
          byId.set(seed.sourceId, fresh);
        }
      }
      return Array.from(byId.values());
    });
    setSeededIds(seedSpeakers.map((s) => s.sourceId));
  }, [seedSpeakers]);

  // Debounced server autosave on any change.
  useEffect(() => {
    if (!loaded || loadError) return;
    const payload: StoredStateV2 = {
      version: 2,
      slides,
      // For event scope with external speakers, don't persist a duplicate copy.
      ...(isExternalSpeakers ? {} : { speakers: internalSpeakers, seededIds }),
    };
    const serialised = JSON.stringify(payload);
    if (serialised === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = payload;
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveState(scope, payload)
        .then(() => {
          lastSavedRef.current = serialised;
          pendingSaveRef.current = null;
          setSaveStatus("saved");
        })
        .catch((err: Error) => {
          console.error("Slide generator save failed:", err);
          setSaveStatus("error");
        });
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [loaded, loadError, scope, slides, internalSpeakers, seededIds, isExternalSpeakers]);

  // Force any debounced save to complete now. Called before server-side
  // export so the renderer reads the current state, not the last-saved one.
  const flushPendingSave = useCallback(async () => {
    if (!pendingSaveRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const payload = pendingSaveRef.current;
    pendingSaveRef.current = null;
    try {
      await saveState(scope, payload);
      lastSavedRef.current = JSON.stringify(payload);
      setSaveStatus("saved");
    } catch (err) {
      setSaveStatus("error");
      throw err;
    }
  }, [scope]);

  const [activeTab, setActiveTab] = useState<SidebarTab>("template");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editingSpeaker, setEditingSpeaker] = useState<SlideSpeaker | null>(null);
  const [speakerFormOpen, setSpeakerFormOpen] = useState(false);
  const [editPositions, setEditPositions] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Live progress while a workflow-driven export is running. `null` between
  // exports. Drives the inline "Exporting X / Y…" indicator in the dialog.
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  // AbortController for the active export. The "Stop waiting" button in the
  // progress indicator calls .abort() — that stops client-side polling but
  // does NOT terminate the server workflow (which keeps running and writing
  // its result to R2 / D1, so the user can hit Export again to pick up the
  // cached result).
  const exportAbortRef = useRef<AbortController | null>(null);
  // Editor zoom (view-only; never persisted into the template/preset).
  const [zoom, setZoom] = useState(1);
  // The scroll/zoom viewport and a measuring element pinned to the unscaled
  // content width. The slide is scaled with a CSS transform on top of this
  // base width, so `baseWidth` (and therefore the export reference width) stays
  // constant regardless of zoom.
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(600);
  const baseWidthRef = useRef(baseWidth);
  baseWidthRef.current = baseWidth;
  // Export reference width = the unscaled base width (zoom-independent).
  const getPreviewWidth = useCallback(() => baseWidthRef.current || undefined, []);

  // Currently selected element in "edit positions" mode (data-slide-el key).
  // Lifted so the Template sidebar can highlight / open the matching control.
  // The nonce lets re-selecting the same element re-trigger the sidebar.
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectNonce, setSelectNonce] = useState(0);
  const handleSelectElement = useCallback((key: string | null) => {
    setSelectedElement(key);
    setSelectNonce((n) => n + 1);
    if (key) setActiveTab("template");
  }, []);

  // Keep `baseWidth` in sync with the available canvas width (responsive,
  // capped by max-w-2xl). Children overflow it when zoomed, so it never grows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: loaded is an intentional trigger — the measured element only mounts after load, so the ResizeObserver must (re)attach when loaded flips
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const sync = () => setBaseWidth(el.clientWidth || 600);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  // Ctrl/Cmd + wheel to zoom (Canva-style). Native non-passive listener so
  // preventDefault actually suppresses the browser's page zoom.
  // biome-ignore lint/correctness/useExhaustiveDependencies: loaded is an intentional trigger — the scroll container only mounts after load, so the non-passive wheel listener must (re)attach when loaded flips
  useEffect(() => {
    const el = canvasScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clampZoom(Math.round(z * Math.exp(-e.deltaY * 0.0015) * 100) / 100));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loaded]);

  // Confirmation / prompt state for in-app dialogs (replaces window.confirm/alert/prompt).
  const [deleteSlideId, setDeleteSlideId] = useState<string | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<SlidePreset | null>(null);
  const [speakerToDelete, setSpeakerToDelete] = useState<SlideSpeaker | null>(null);
  const [presetPromptOpen, setPresetPromptOpen] = useState(false);

  const [presets, setPresets] = useState<SlidePreset[] | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const refreshPresets = useCallback(() => {
    fetchPresets()
      .then((rows) => {
        setPresets(rows);
        setPresetsError(null);
      })
      .catch((err: Error) => setPresetsError(err.message));
  }, []);
  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  const selectedSlide = slides.find((s) => s.id === selectedSlideId) ?? slides[0] ?? null;
  const template = selectedSlide?.template ?? defaultSlideTemplate();
  const selectedSpeaker = speakers[selectedIdx] ?? null;

  // Zoom stage dimensions: the slide renders at `baseWidth` and is scaled by
  // `zoom` with a CSS transform; the outer box reserves the post-zoom footprint
  // so the viewport can scroll/pan to every edge.
  const previewConfig = ASPECT_RATIOS[template.aspect_ratio] ?? ASPECT_RATIOS["16:9"];
  const stageWidth = Math.max(1, baseWidth * zoom);
  const stageHeight = (stageWidth * previewConfig.height) / previewConfig.width;

  const updateTemplate = useCallback(
    (patch: Partial<SlideTemplate>) => {
      const id = selectedSlide?.id;
      if (!id) return;
      setSlides((prev) =>
        prev.map((s) => (s.id === id ? { ...s, template: { ...s.template, ...patch } } : s)),
      );
    },
    [selectedSlide?.id],
  );

  // Slide-type management
  const addSlide = useCallback(() => {
    // Default new slide uses a different aspect ratio if the current is 16:9, else 16:9.
    const base = selectedSlide?.template ?? defaultSlideTemplate();
    const nextAspect = base.aspect_ratio === "16:9" ? "1:1" : "16:9";
    const fresh: SlideTemplate = {
      ...defaultSlideTemplate(),
      header_text: base.header_text,
      event_date: base.event_date,
      aspect_ratio: nextAspect,
    };
    const id = randomId();
    setSlides((prev) => [...prev, { id, label: `Slide ${prev.length + 1}`, template: fresh }]);
    setSelectedSlideId(id);
  }, [selectedSlide]);

  const duplicateSlide = useCallback(() => {
    if (!selectedSlide) return;
    const id = randomId();
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === selectedSlide.id);
      const copy: SlideEntry = {
        id,
        label: `${selectedSlide.label} copy`,
        template: { ...selectedSlide.template },
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelectedSlideId(id);
  }, [selectedSlide]);

  const requestDeleteSlide = useCallback(
    (id: string) => {
      if (slides.length <= 1) return;
      setDeleteSlideId(id);
    },
    [slides.length],
  );

  const confirmDeleteSlide = useCallback(() => {
    const id = deleteSlideId;
    if (!id) return;
    setDeleteSlideId(null);
    setSlides((prev) => prev.filter((s) => s.id !== id));
    if (selectedSlideId === id) {
      const remaining = slides.filter((s) => s.id !== id);
      setSelectedSlideId(remaining[0]?.id ?? "");
    }
  }, [deleteSlideId, slides, selectedSlideId]);

  const renameSlide = useCallback((id: string, label: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }, []);

  // Apply a preset to the currently selected slide.
  const applyPreset = useCallback(
    (preset: SlidePreset) => {
      if (!selectedSlide) return;
      const id = selectedSlide.id;
      setSlides((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                template: {
                  ...preset.data,
                  header_text: s.template.header_text,
                },
              }
            : s,
        ),
      );
    },
    [selectedSlide],
  );

  const openSavePresetPrompt = useCallback(() => {
    if (!selectedSlide) return;
    setPresetPromptOpen(true);
  }, [selectedSlide]);

  const savePresetWithName = useCallback(
    async (name: string) => {
      if (!selectedSlide || !name.trim()) {
        setPresetPromptOpen(false);
        return;
      }
      try {
        const data: SlideTemplate = {
          ...selectedSlide.template,
          header_text: "",
        };
        await apiCreatePreset(name.trim(), data);
        refreshPresets();
        toast.success(`Preset "${name.trim()}" saved`);
      } catch (err) {
        toast.error("Failed to save preset", err instanceof Error ? err.message : String(err));
      } finally {
        setPresetPromptOpen(false);
      }
    },
    [selectedSlide, refreshPresets, toast],
  );

  const requestRemovePreset = useCallback((preset: SlidePreset) => {
    setPresetToDelete(preset);
  }, []);

  const confirmRemovePreset = useCallback(async () => {
    const preset = presetToDelete;
    if (!preset) return;
    setPresetToDelete(null);
    try {
      await apiDeletePreset(preset.id);
      refreshPresets();
    } catch (err) {
      toast.error("Failed to delete preset", err instanceof Error ? err.message : String(err));
    }
  }, [presetToDelete, refreshPresets, toast]);

  const downloadPreset = useCallback((preset: SlidePreset) => {
    const payload = { version: 1, name: preset.name, data: preset.data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preset.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "preset"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const uploadPresetFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as { name?: unknown; data?: unknown };
        const data = parsed.data;
        if (!data || typeof data !== "object" || !("layout" in data) || !("aspect_ratio" in data)) {
          throw new Error("File doesn't look like a slide preset (missing data.layout)");
        }
        const fallbackName = file.name.replace(/\.json$/i, "").replace(/_/g, " ");
        const name = (typeof parsed.name === "string" && parsed.name.trim()) || fallbackName;
        await apiCreatePreset(name, data as SlideTemplate);
        refreshPresets();
        toast.success(`Preset "${name}" imported`);
      } catch (err) {
        toast.error("Failed to import preset", err instanceof Error ? err.message : String(err));
      }
    },
    [refreshPresets, toast],
  );

  const handleAddSpeaker = () => {
    setEditingSpeaker(null);
    setSpeakerFormOpen(true);
  };

  const handleEditSpeaker = (speaker: SlideSpeaker) => {
    setEditingSpeaker(speaker);
    setSpeakerFormOpen(true);
  };

  const handleSaveSpeaker = (speaker: SlideSpeaker) => {
    setInternalSpeakers((prev) => {
      const idx = prev.findIndex((s) => s.id === speaker.id);
      if (idx === -1) return [...prev, speaker];
      const next = [...prev];
      next[idx] = speaker;
      return next;
    });
    setSpeakerFormOpen(false);
    setEditingSpeaker(null);
  };

  const handleDeleteSpeaker = (speaker: SlideSpeaker) => {
    setSpeakerToDelete(speaker);
  };

  const confirmDeleteSpeaker = useCallback(() => {
    const speaker = speakerToDelete;
    if (!speaker) return;
    setSpeakerToDelete(null);
    setInternalSpeakers((prev) => prev.filter((s) => s.id !== speaker.id));
    if (selectedIdx >= speakers.length - 1) {
      setSelectedIdx(Math.max(0, speakers.length - 2));
    }
  }, [speakerToDelete, selectedIdx, speakers.length]);

  const safeName = (name: string) => name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");

  const exportFilename = (slide: SlideEntry, speaker: SlideSpeaker) =>
    slides.length > 1
      ? `${filenameSlug}_${safeName(speaker.name)}_${safeName(slide.label || slide.template.aspect_ratio)}.png`
      : `${filenameSlug}_${safeName(speaker.name)}.png`;

  // Resolved event id (null for "global" scope or any pre-save state where
  // speakers don't have DB ids yet). When non-null, batch exports go through
  // the SlideExportWorkflow; otherwise we fall back to the client-side
  // html-to-image renderer that keeps the editor usable offline / pre-save.
  const eventId = scope.startsWith("event:") ? scope.slice("event:".length) : null;
  const canUseWorkflow = useCallback(
    (targetSpeakers: SlideSpeaker[]) =>
      eventId !== null && targetSpeakers.length > 0 && targetSpeakers.every((s) => Boolean(s.id)),
    [eventId],
  );

  // Drive the SlideExportWorkflow for a set of (slideIds × speakerIds).
  // Posts to /api/admin/slide-export, polls progress, and triggers the
  // browser download on completion. Caller handles error toasts.
  const runWorkflowExport = useCallback(
    async (slideIds: string[], speakerIds: string[]) => {
      if (!eventId) throw new Error("Workflow export requires an event-scoped editor");
      await flushPendingSave();
      const controller = new AbortController();
      exportAbortRef.current = controller;
      try {
        await runExport(
          {
            eventId,
            slideIds,
            speakerIds,
            filenameBase: filenameSlug,
            refWidth: getPreviewWidth(),
            // Match the old client-side filename behaviour: when the editor
            // has multiple slide types, every export filename includes the
            // slide label so per-slide downloads don't collide.
            disambiguateFilenames: slides.length > 1,
          },
          {
            onProgress: setExportProgress,
            abortSignal: controller.signal,
          },
        );
      } finally {
        if (exportAbortRef.current === controller) {
          exportAbortRef.current = null;
        }
      }
    },
    [eventId, filenameSlug, flushPendingSave, getPreviewWidth, slides.length],
  );

  // Local-only fallback used for "global" scope and pre-save speakers.
  // Renders each (slide, speaker) via html-to-image and downloads
  // individually (or zips them when there's more than one entry).
  // biome-ignore lint/correctness/useExhaustiveDependencies: exportFilename is recreated each render (it reads filenameSlug + slides.length, both already listed) — adding it would break this memo; slides.length stays because the callback depends on it transitively
  const runClientExport = useCallback(
    async (pairs: { slide: SlideEntry; speaker: SlideSpeaker }[]) => {
      if (pairs.length === 0) return;
      if (pairs.length === 1) {
        const { slide, speaker } = pairs[0];
        const url = await renderSlideToDataURL(slide.template, speaker, getPreviewWidth());
        downloadDataURL(url, exportFilename(slide, speaker));
        return;
      }
      const entries: { dataUrl: string; filename: string }[] = [];
      for (const { slide, speaker } of pairs) {
        const url = await renderSlideToDataURL(slide.template, speaker, getPreviewWidth());
        entries.push({ dataUrl: url, filename: exportFilename(slide, speaker) });
        setExportProgress({
          status: "running",
          completedCount: entries.length,
          totalCount: pairs.length,
          slow: false,
        });
      }
      await downloadDataURLsAsZip(entries, `${filenameSlug}_all.zip`);
    },
    [getPreviewWidth, filenameSlug, slides.length],
  );

  const beginExport = useCallback(() => {
    setExporting(true);
    setExportProgress(null);
  }, []);
  const finishExport = useCallback(() => {
    setExporting(false);
    setExportProgress(null);
    exportAbortRef.current = null;
  }, []);
  // Surfaced via the progress indicator's "Stop waiting" button. The
  // workflow keeps running on the server — this just stops the client-side
  // poll loop so the user isn't pinned to the dialog.
  const cancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);
  // Treat an AbortError as a user-initiated cancel: no toast, no log noise.
  const isAbortError = (err: unknown): boolean =>
    err instanceof DOMException && err.name === "AbortError";

  // biome-ignore lint/correctness/useExhaustiveDependencies: isAbortError is a stable pure helper recreated each render; intentionally omitted to keep this callback's identity stable
  const exportOne = useCallback(
    async (speaker: SlideSpeaker, slide: SlideEntry) => {
      beginExport();
      try {
        if (canUseWorkflow([speaker])) {
          await runWorkflowExport([slide.id], [speaker.id as string]);
        } else {
          await runClientExport([{ slide, speaker }]);
        }
      } catch (err) {
        if (isAbortError(err)) {
          // User clicked "Stop waiting"; the workflow continues on the
          // server, so no toast or log noise.
          return;
        }
        console.error("Slide export failed:", err);
        toast.error("Slide export failed", err instanceof Error ? err.message : String(err));
      } finally {
        finishExport();
      }
    },
    [canUseWorkflow, runWorkflowExport, runClientExport, toast, beginExport, finishExport],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: isAbortError is a stable pure helper recreated each render; intentionally omitted to keep this callback's identity stable
  const exportSlideForAll = useCallback(
    async (slide: SlideEntry) => {
      if (speakers.length === 0) return;
      beginExport();
      try {
        if (canUseWorkflow(speakers)) {
          await runWorkflowExport(
            [slide.id],
            speakers.map((s) => s.id as string),
          );
        } else {
          await runClientExport(speakers.map((speaker) => ({ slide, speaker })));
        }
      } catch (err) {
        if (isAbortError(err)) return;
        console.error("Bulk export failed:", err);
        toast.error("Bulk export failed", err instanceof Error ? err.message : String(err));
      } finally {
        finishExport();
      }
    },
    [
      speakers,
      canUseWorkflow,
      runWorkflowExport,
      runClientExport,
      toast,
      beginExport,
      finishExport,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: isAbortError is a stable pure helper recreated each render; intentionally omitted to keep this callback's identity stable
  const exportAllSlidesAllSpeakers = useCallback(async () => {
    if (speakers.length === 0 || slides.length === 0) return;
    beginExport();
    try {
      if (canUseWorkflow(speakers)) {
        await runWorkflowExport(
          slides.map((s) => s.id),
          speakers.map((s) => s.id as string),
        );
      } else {
        const pairs: { slide: SlideEntry; speaker: SlideSpeaker }[] = [];
        for (const slide of slides) {
          for (const speaker of speakers) pairs.push({ slide, speaker });
        }
        await runClientExport(pairs);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Bulk export failed:", err);
      toast.error("Bulk export failed", err instanceof Error ? err.message : String(err));
    } finally {
      finishExport();
    }
  }, [
    speakers,
    slides,
    canUseWorkflow,
    runWorkflowExport,
    runClientExport,
    toast,
    beginExport,
    finishExport,
  ]);

  const tabs: { key: SidebarTab; icon: typeof Settings2; label: string }[] = useMemo(() => {
    const base: { key: SidebarTab; icon: typeof Settings2; label: string }[] = [
      { key: "template", icon: Settings2, label: "Template" },
    ];
    if (!isExternalSpeakers) base.push({ key: "speakers", icon: Users, label: "Speakers" });
    return base;
  }, [isExternalSpeakers]);

  if (!loaded) {
    return (
      <div className="bg-[#1C1917] text-white flex items-center justify-center min-h-[640px] rounded-xl border border-white/[0.06]">
        <div className="flex items-center gap-2 text-[#78716C] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading slide generator…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-[#1C1917] text-white flex items-center justify-center min-h-[640px] rounded-xl border border-red-500/30 p-6">
        <div className="text-red-300 text-sm text-center max-w-md">
          <div className="font-medium mb-1">Failed to load slide generator state</div>
          <div className="text-xs text-[#A8A29E]">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1C1917] text-white flex flex-col lg:h-[calc(100vh-180px)] lg:min-h-[640px] min-h-[640px] rounded-xl overflow-hidden border border-white/[0.06]">
      {/* Top slide-type bar — spans full width above sidebar + canvas */}
      <div className="border-b border-white/[0.06] bg-[#1C1917] px-3 py-2 shrink-0">
        <SlideTypeBar
          slides={slides}
          selectedId={selectedSlideId}
          onSelect={setSelectedSlideId}
          onAdd={addSlide}
          onDuplicate={duplicateSlide}
          onDelete={requestDeleteSlide}
          onRename={renameSlide}
        />
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Sidebar */}
        <div className="lg:w-72 bg-[#1C1917] border-r border-white/[0.06] flex flex-col shrink-0 min-h-0">
          <div className="flex border-b border-white/[0.06]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                    active
                      ? "text-[#D4836A] border-[#D4836A]"
                      : "text-[#78716C] border-transparent hover:text-[#A8A29E]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === "template" && (
              <>
                <PresetsSection
                  presets={presets}
                  error={presetsError}
                  onApply={applyPreset}
                  onSaveCurrent={openSavePresetPrompt}
                  onDelete={requestRemovePreset}
                  onDownload={downloadPreset}
                  onUpload={uploadPresetFile}
                />
                <TemplatePanel
                  template={template}
                  onChange={updateTemplate}
                  selectedElementKey={editPositions ? selectedElement : null}
                  selectionNonce={selectNonce}
                />
              </>
            )}

            {activeTab === "speakers" && !isExternalSpeakers && (
              <div className="p-4 space-y-2">
                <button
                  type="button"
                  onClick={handleAddSpeaker}
                  className="w-full bg-[#D4836A] hover:bg-[#c4775f] text-white text-xs gap-1.5 h-9 inline-flex items-center justify-center rounded-md font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add speaker
                </button>

                {seedSpeakers && seedSpeakers.length > 0 && (
                  <button
                    type="button"
                    onClick={resyncFromSeed}
                    className="w-full bg-[#2D2926] hover:bg-white/[0.05] text-[#A8A29E] hover:text-white text-[11px] h-8 inline-flex items-center justify-center rounded-md border border-white/[0.06]"
                    title="Pull the latest name / bio / photo from the event agenda."
                  >
                    Re-sync from agenda
                  </button>
                )}

                {internalSpeakers.length === 0 ? (
                  <div className="text-center py-8 text-[#78716C] text-xs">
                    No speakers yet. Add your first speaker.
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-2">
                    {internalSpeakers.map((speaker, idx) => {
                      const active = selectedIdx === idx;
                      return (
                        // biome-ignore lint/a11y/useSemanticElements: row contains nested icon buttons, so it can't be a <button>
                        <div
                          key={speaker.id}
                          role="button"
                          tabIndex={0}
                          className={`flex items-center gap-3 rounded-lg p-3 transition-all group cursor-pointer ${
                            active
                              ? "bg-[#2D2926] border border-[#D4836A]"
                              : "border border-transparent hover:bg-white/[0.03]"
                          }`}
                          onClick={() => setSelectedIdx(idx)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedIdx(idx);
                            }
                          }}
                        >
                          <div className="w-9 h-9 rounded-full shrink-0 bg-[#2D2926] border border-white/[0.08] overflow-hidden flex items-center justify-center">
                            {speaker.headshot_url ? (
                              <SlideImage
                                src={speaker.headshot_url}
                                alt={speaker.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold text-[#78716C]">
                                {speaker.name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {speaker.name}
                            </div>
                            <div className="text-[10px] text-[#78716C] truncate">
                              {[speaker.title, speaker.company].filter(Boolean).join(", ") ||
                                "No details"}
                            </div>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              className="h-6 w-6 rounded text-[#78716C] hover:text-white hover:bg-white/[0.06] flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditSpeaker(speaker);
                              }}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              className="h-6 w-6 rounded text-[#78716C] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSpeaker(speaker);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] p-3 shrink-0">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="w-full bg-[#D4836A] hover:bg-[#c4775f] text-white text-xs gap-2 h-9 inline-flex items-center justify-center rounded-md font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export…
            </button>
          </div>

          <SaveStatusBar status={saveStatus} />
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#0f0e0c] flex flex-col min-w-0 min-h-0">
          {/* Toolbar — fixed above the scrollable/zoomable viewport */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 pt-4 pb-2 shrink-0">
            <span className="text-[11px] text-[#78716C] truncate">
              {speakers.length === 0
                ? "Preview with placeholder content"
                : `Slide ${selectedIdx + 1} of ${speakers.length}`}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <ZoomControl zoom={zoom} onChange={(z) => setZoom(clampZoom(z))} />
              <button
                type="button"
                onClick={() =>
                  setEditPositions((v) => {
                    const next = !v;
                    if (!next) handleSelectElement(null);
                    return next;
                  })
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  editPositions
                    ? "bg-[#D4836A] text-white shadow-md shadow-[#D4836A]/30"
                    : "bg-[#2D2926] text-[#A8A29E] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                {editPositions ? "Done editing" : "Edit positions"}
              </button>
            </div>
          </div>

          {/* Scrollable, zoomable viewport (Ctrl/Cmd + wheel to zoom) */}
          <div
            ref={canvasScrollRef}
            className="flex-1 overflow-auto min-h-0 px-4 sm:px-6 lg:px-8 pb-6"
          >
            <div ref={measureRef} className="w-full max-w-2xl mx-auto">
              <div className="mx-auto" style={{ width: stageWidth }}>
                <div
                  className={`rounded-xl overflow-hidden border shadow-2xl shadow-black/40 ${
                    editPositions ? "border-[#D4836A]/60" : "border-white/[0.06]"
                  }`}
                  style={{ width: stageWidth, height: stageHeight }}
                >
                  {editPositions ? (
                    <DraggableSlideEditor
                      template={template}
                      speaker={selectedSpeaker}
                      onChange={updateTemplate}
                      zoom={zoom}
                      baseWidth={baseWidth}
                      onSelect={handleSelectElement}
                    />
                  ) : (
                    <div
                      style={{
                        width: baseWidth,
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <SlideUiPreview template={template} speaker={selectedSpeaker} />
                    </div>
                  )}
                </div>
              </div>

              {speakers.length > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedIdx((i) => (i > 0 ? i - 1 : speakers.length - 1))}
                    className="h-8 w-8 rounded text-[#78716C] hover:text-white hover:bg-[#2D2926] flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    {speakers.map((speaker, idx) => (
                      <button
                        key={speaker.id}
                        type="button"
                        onClick={() => setSelectedIdx(idx)}
                        className={`h-2 rounded-full transition-all ${
                          selectedIdx === idx
                            ? "bg-[#D4836A] w-6"
                            : "bg-white/[0.12] hover:bg-white/[0.25] w-2"
                        }`}
                        aria-label={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIdx((i) => (i < speakers.length - 1 ? i + 1 : 0))}
                    className="h-8 w-8 rounded text-[#78716C] hover:text-white hover:bg-[#2D2926] flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-[#78716C] ml-2">
                    {selectedIdx + 1} / {speakers.length}
                  </span>
                </div>
              )}

              {speakers.length === 0 && !isExternalSpeakers && (
                <div className="text-center mt-6">
                  <p className="text-[#78716C] text-sm mb-3">
                    Add speakers to render real slides — the preview uses placeholder content.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("speakers");
                      handleAddSpeaker();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#D4836A] hover:bg-[#c4775f] text-white text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add first speaker
                  </button>
                </div>
              )}

              {speakers.length === 0 && isExternalSpeakers && (
                <div className="text-center mt-6 text-[#78716C] text-sm">
                  No speakers configured for this event yet — add them in the Speakers tab.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        speakers={speakers}
        slides={slides}
        selectedSpeaker={selectedSpeaker}
        selectedSlide={selectedSlide}
        exporting={exporting}
        exportProgress={exportProgress}
        isExternalSpeakers={isExternalSpeakers}
        onExportOne={exportOne}
        onExportSlideForAll={exportSlideForAll}
        onExportAll={exportAllSlidesAllSpeakers}
        onCancelExport={cancelExport}
      />

      <SpeakerEditModal
        open={speakerFormOpen}
        speaker={editingSpeaker}
        onCancel={() => {
          setSpeakerFormOpen(false);
          setEditingSpeaker(null);
        }}
        onSave={handleSaveSpeaker}
      />

      <ConfirmDialog
        open={deleteSlideId !== null}
        variant="destructive"
        title="Delete slide type?"
        description="Its template settings will be lost."
        confirmLabel="Delete"
        onCancel={() => setDeleteSlideId(null)}
        onConfirm={confirmDeleteSlide}
      />

      <ConfirmDialog
        open={presetToDelete !== null}
        variant="destructive"
        title={presetToDelete ? `Delete preset "${presetToDelete.name}"?` : "Delete preset?"}
        confirmLabel="Delete"
        onCancel={() => setPresetToDelete(null)}
        onConfirm={confirmRemovePreset}
      />

      <ConfirmDialog
        open={speakerToDelete !== null}
        variant="destructive"
        title={speakerToDelete ? `Remove ${speakerToDelete.name}?` : "Remove speaker?"}
        confirmLabel="Remove"
        onCancel={() => setSpeakerToDelete(null)}
        onConfirm={confirmDeleteSpeaker}
      />

      <PromptDialog
        open={presetPromptOpen}
        title="Save current style as preset"
        description="Pick a short, memorable name. Presets save visual styling only — header text and speakers are not included."
        label="Preset name"
        initialValue=""
        placeholder="e.g. Coral on dark — bottom left"
        confirmLabel="Save"
        onCancel={() => setPresetPromptOpen(false)}
        onConfirm={savePresetWithName}
      />
    </div>
  );
}

function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-[#2D2926] border border-white/[0.06] p-0.5">
      <button
        type="button"
        onClick={() => onChange(zoom - 0.25)}
        title="Zoom out"
        aria-label="Zoom out"
        className="h-6 w-6 rounded text-[#A8A29E] hover:text-white hover:bg-white/[0.06] flex items-center justify-center"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => onChange(1)}
        title="Reset zoom to 100%"
        className="px-1 text-[11px] text-[#A8A29E] hover:text-white tabular-nums w-10 text-center"
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={() => onChange(zoom + 0.25)}
        title="Zoom in"
        aria-label="Zoom in"
        className="h-6 w-6 rounded text-[#A8A29E] hover:text-white hover:bg-white/[0.06] flex items-center justify-center"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function SlideTypeBar({
  slides,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
}: {
  slides: SlideEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (entry: SlideEntry) => {
    setRenamingId(entry.id);
    setRenameValue(entry.label);
  };

  const commitRename = () => {
    if (renamingId) {
      const label = renameValue.trim() || "Untitled";
      onRename(renamingId, label);
    }
    setRenamingId(null);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap bg-[#1C1917]/60 border border-white/[0.06] rounded-lg p-1.5">
      <Layers className="w-3.5 h-3.5 text-[#78716C] ml-1.5 shrink-0" />
      {slides.map((slide) => {
        const active = slide.id === selectedId;
        if (renamingId === slide.id) {
          return (
            <input
              key={slide.id}
              value={renameValue}
              // biome-ignore lint/a11y/noAutofocus: focus the input when entering inline rename mode
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="bg-[#2D2926] border border-[#D4836A] rounded px-2 py-1 text-xs text-white w-24"
            />
          );
        }
        return (
          <div key={slide.id} className="flex items-center group">
            <button
              type="button"
              onClick={() => onSelect(slide.id)}
              onDoubleClick={() => startRename(slide)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                active
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#2D2926] text-[#A8A29E] hover:bg-white/[0.06] hover:text-white"
              }`}
              title="Click to switch · double-click to rename"
            >
              {slide.label}
              <span className="ml-1.5 opacity-60 text-[10px]">{slide.template.aspect_ratio}</span>
            </button>
            <button
              type="button"
              onClick={() => startRename(slide)}
              className="ml-0.5 p-1 rounded text-[#78716C] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Rename slide"
              title="Rename this slide"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            {active && slides.length > 1 && (
              <button
                type="button"
                onClick={() => onDelete(slide.id)}
                className="ml-0.5 p-1 rounded text-[#78716C] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete slide type"
                title="Delete this slide type"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onDuplicate}
        className="px-2 py-1 rounded text-[10px] text-[#A8A29E] hover:text-white hover:bg-white/[0.06] inline-flex items-center gap-1"
        title="Duplicate current slide type"
      >
        <CopyIcon className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="px-2 py-1 rounded text-[10px] text-[#D4836A] hover:text-white hover:bg-[#D4836A]/20 inline-flex items-center gap-1"
        title="Add a new slide type"
      >
        <Plus className="w-3 h-3" />
        Add
      </button>
    </div>
  );
}

function PresetsSection({
  presets,
  error,
  onApply,
  onSaveCurrent,
  onDelete,
  onDownload,
  onUpload,
}: {
  presets: SlidePreset[] | null;
  error: string | null;
  onApply: (p: SlidePreset) => void;
  onSaveCurrent: () => void;
  onDelete: (p: SlidePreset) => void;
  onDownload: (p: SlidePreset) => void;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-widest text-[#78716C]">Style presets</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveCurrent}
            className="text-[10px] text-[#D4836A] hover:text-[#E09880] font-medium"
          >
            Save current
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[#78716C] hover:text-white p-0.5"
            aria-label="Import preset from JSON"
            title="Import preset from JSON"
          >
            <Upload className="w-3 h-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <div className="text-[10px] text-red-300/80 mb-2">Couldn&apos;t load presets: {error}</div>
      )}

      {presets === null ? (
        <div className="text-[10px] text-[#78716C]">Loading…</div>
      ) : presets.length === 0 ? (
        <div className="text-[10px] text-[#78716C]">
          No saved presets yet. Save the current style to reuse it across events.
        </div>
      ) : (
        <div className="space-y-1">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center gap-1 rounded-md hover:bg-white/[0.03] transition-colors group"
            >
              <button
                type="button"
                onClick={() => onApply(preset)}
                className="flex-1 text-left text-xs text-[#A8A29E] hover:text-white px-2 py-1.5 truncate"
                title={`Apply "${preset.name}"`}
              >
                {preset.name}
              </button>
              <button
                type="button"
                onClick={() => onDownload(preset)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#78716C] hover:text-white px-1 py-1"
                aria-label={`Download preset ${preset.name}`}
                title="Download as JSON"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(preset)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#78716C] hover:text-red-400 px-1 py-1"
                aria-label={`Delete preset ${preset.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveStatusBar({ status }: { status: SaveStatus }) {
  return (
    <div className="border-t border-white/[0.06] px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-[#78716C]">
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Cloud className="w-3 h-3" />
          Saved
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="w-3 h-3 text-red-400" />
          <span className="text-red-300/80">Save failed — your edits are kept in memory only</span>
        </>
      )}
      {status === "idle" && <span className="opacity-40">Synced to server</span>}
    </div>
  );
}

function ExportDialog({
  open,
  onClose,
  speakers,
  slides,
  selectedSpeaker,
  selectedSlide,
  exporting,
  exportProgress,
  isExternalSpeakers,
  onExportOne,
  onExportSlideForAll,
  onExportAll,
  onCancelExport,
}: {
  open: boolean;
  onClose: () => void;
  speakers: SlideSpeaker[];
  slides: SlideEntry[];
  selectedSpeaker: SlideSpeaker | null;
  selectedSlide: SlideEntry | null;
  exporting: boolean;
  exportProgress: ExportProgress | null;
  isExternalSpeakers: boolean;
  onExportOne: (speaker: SlideSpeaker, slide: SlideEntry) => void;
  onExportSlideForAll: (slide: SlideEntry) => void;
  onExportAll: () => void;
  onCancelExport: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, exporting, onClose]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !exporting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="bg-[#1f1f1f] border border-[#333] rounded-xl w-full max-w-md shadow-xl"
      >
        <div className="px-5 pt-5 pb-3">
          <h3 id="export-dialog-title" className="text-white font-semibold">
            Export slides
          </h3>
          <p className="text-xs text-[#78716C] mt-1">
            Export slides for {speakers.length} speaker{speakers.length !== 1 ? "s" : ""} across{" "}
            {slides.length} slide type{slides.length !== 1 ? "s" : ""}. Batches are rendered
            server-side and bundled into a single ZIP download.
          </p>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {selectedSpeaker && selectedSlide && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#78716C] mb-2">
                Current speaker · {selectedSlide.label}
              </div>
              <button
                type="button"
                onClick={() => onExportOne(selectedSpeaker, selectedSlide)}
                disabled={exporting}
                className="w-full bg-[#2D2926] hover:bg-white/[0.08] text-white text-xs gap-2 h-9 inline-flex items-center justify-start px-3 rounded-md disabled:opacity-50"
              >
                <FileImage className="w-3.5 h-3.5" />
                Export {selectedSpeaker.name}&apos;s slide
              </button>
            </div>
          )}

          {selectedSlide && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#78716C] mb-2">
                All speakers · {selectedSlide.label}
              </div>
              <button
                type="button"
                onClick={() => onExportSlideForAll(selectedSlide)}
                disabled={exporting || speakers.length === 0}
                className="w-full bg-[#2D2926] hover:bg-white/[0.08] text-white text-xs gap-2 h-9 inline-flex items-center justify-start px-3 rounded-md disabled:opacity-50"
              >
                <FileImage className="w-3.5 h-3.5" />
                Export all speakers ({selectedSlide.label})
              </button>
            </div>
          )}

          {slides.length > 1 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#78716C] mb-2">
                Every slide type · every speaker
              </div>
              <button
                type="button"
                onClick={() => onExportAll()}
                disabled={exporting || speakers.length === 0}
                className="w-full bg-[#D4836A] hover:bg-[#c4775f] text-white text-xs gap-2 h-10 inline-flex items-center justify-center rounded-md disabled:opacity-50 font-medium"
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileImage className="w-3.5 h-3.5" />
                )}
                Export everything ({speakers.length * slides.length} slides)
              </button>
            </div>
          )}

          {exporting && (
            <ExportProgressIndicator progress={exportProgress} onCancel={onCancelExport} />
          )}

          {speakers.length === 0 && (
            <div className="text-center py-4 text-[#78716C] text-xs">
              {isExternalSpeakers
                ? "Add speakers in the Speakers tab to generate slides."
                : "Add speakers first to generate slides."}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#333] flex justify-end gap-2 bg-[#1a1a1a] rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-3 py-1.5 text-sm text-gray-300 hover:bg-[#333] rounded-lg disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportProgressIndicator({
  progress,
  onCancel,
}: {
  progress: ExportProgress | null;
  onCancel: () => void;
}) {
  const completed = progress?.completedCount ?? 0;
  const total = progress?.totalCount ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const slow = progress?.slow === true && progress.status !== "complete";
  const label = (() => {
    if (!progress) return "Preparing export…";
    if (progress.status === "queued") return "Queued — waiting for a render slot…";
    if (progress.status === "complete") return "Done — your download is starting.";
    return `Rendering ${completed} / ${total} slide${total === 1 ? "" : "s"}…`;
  })();
  return (
    <div className="pt-1">
      <div className="text-[11px] text-[#A8A29E] mb-1 flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        {label}
      </div>
      <div className="h-1 bg-[#2D2926] rounded overflow-hidden">
        <div
          className="h-full bg-[#D4836A] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {slow && (
        <div className="mt-2 text-[11px] text-[#A8A29E] flex items-center justify-between gap-2">
          <span>
            Taking longer than usual — Cloudflare may be retrying internally. Rendering continues in
            the background.
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 underline text-[#D4836A] hover:text-[#E8A083]"
          >
            Stop waiting
          </button>
        </div>
      )}
    </div>
  );
}
