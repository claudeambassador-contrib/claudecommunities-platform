import type { App } from "@modelcontextprotocol/ext-apps";
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SlideSpeaker,
  SlideTemplate,
} from "@app/components/slide-generator/types";
import { callTool } from "../lib/callTool";

interface SlideEntry {
  id: string;
  label: string;
  template: SlideTemplate;
}

interface SlideStateResponse {
  scope: string;
  data: { version: number; slides: SlideEntry[] };
  updatedAt?: string;
}

interface EventSpeakerRow {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  talkDescriptionShort: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}

function toSlideSpeaker(s: EventSpeakerRow): SlideSpeaker {
  return {
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
  };
}

interface Combo {
  slide: SlideEntry;
  speaker: SlideSpeaker;
  key: string;
}

type ResourceContent = { uri: string; mimeType?: string; blob?: string };

function pickBlobContent(contents: unknown): ResourceContent | null {
  if (!Array.isArray(contents)) return null;
  for (const c of contents) {
    if (
      c &&
      typeof c === "object" &&
      "blob" in c &&
      typeof (c as { blob?: string }).blob === "string"
    ) {
      return c as ResourceContent;
    }
  }
  return null;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface CachedPng {
  blobUrl: string;
  bytes: Uint8Array;
  mimeType: string;
}

// Unwrap whatever the MCP bridge / fetch / image load rejects with into a
// human-readable string. Without this, `String(event)` produces the useless
// "[object Event]" banner we saw when an Event-shaped rejection bubbles up.
function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err instanceof Event) {
    const target = err.target as { src?: string; url?: string } | null;
    const src = target?.src || target?.url;
    return src ? `${err.type} event (${src})` : `${err.type} event`;
  }
  try {
    const s = JSON.stringify(err);
    if (s && s !== "{}") return s;
  } catch {
    // fall through
  }
  return String(err);
}

export function SlidesPreview({ app, eventId }: { app: App; eventId: string }) {
  const [slides, setSlides] = useState<SlideEntry[]>([]);
  const [speakers, setSpeakers] = useState<SlideSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Blob URL cache keyed by `${slideId}:${speakerId}`. Created on-demand by
  // the per-combo effect below, revoked when the combo leaves the cache or
  // the component unmounts.
  const [renderCache, setRenderCache] = useState<Map<string, CachedPng>>(
    () => new Map(),
  );
  // Mirror of `renderCache` for the unmount cleanup — React's cleanup
  // closure captures the initial empty map otherwise, leaking every blob
  // URL we created during the session.
  const renderCacheRef = useRef(renderCache);
  useEffect(() => {
    renderCacheRef.current = renderCache;
  }, [renderCache]);
  const [activeBlobLoading, setActiveBlobLoading] = useState(false);
  const [activeBlobError, setActiveBlobError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [state, rows] = await Promise.all([
          callTool<SlideStateResponse>(app, "getSlideGeneratorState", {
            scope: `event:${eventId}`,
          }),
          callTool<EventSpeakerRow[]>(app, "listEventSpeakers", { eventId }),
        ]);
        if (cancelled) return;
        setSlides(state?.data?.slides ?? []);
        setSpeakers(rows.map(toSlideSpeaker));
      } catch (err) {
        if (!cancelled) {
          console.error("[SlidesPreview] initial load failed:", err);
          setError(formatErr(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, eventId]);

  const combos = useMemo<Combo[]>(() => {
    const out: Combo[] = [];
    for (const slide of slides) {
      for (const speaker of speakers) {
        out.push({ slide, speaker, key: `${slide.id}:${speaker.id}` });
      }
    }
    return out;
  }, [slides, speakers]);

  useEffect(() => {
    if (index >= combos.length) setIndex(0);
  }, [combos.length, index]);

  const active = combos[index] ?? null;
  const cached = active ? renderCache.get(active.key) : undefined;

  // Render the active combo's PNG on demand. Skipped when cached.
  useEffect(() => {
    if (!active || cached) {
      setActiveBlobLoading(false);
      setActiveBlobError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    let handedOff = false;
    setActiveBlobLoading(true);
    setActiveBlobError(null);
    (async () => {
      try {
        const uri = `ccau://slides/${encodeURIComponent(eventId)}/${encodeURIComponent(active.slide.id)}/${encodeURIComponent(active.speaker.id)}`;
        const result = await app.readServerResource({ uri });
        const content = pickBlobContent(result.contents);
        if (!content?.blob) throw new Error("Resource returned no blob content");
        const bytes = base64ToBytes(content.blob);
        const mimeType = content.mimeType || "image/png";
        const blob = new Blob([bytes], { type: mimeType });
        createdUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          createdUrl = null;
          return;
        }
        setRenderCache((prev) => {
          const next = new Map(prev);
          next.set(active.key, { blobUrl: createdUrl as string, bytes, mimeType });
          return next;
        });
        handedOff = true;
      } catch (err) {
        if (!cancelled) {
          console.error("[SlidesPreview] slide render fetch failed:", err);
          setActiveBlobError(formatErr(err));
        }
      } finally {
        if (!cancelled) setActiveBlobLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      // Only revoke if we never handed the URL off to the cache. Don't rely on
      // `renderCache.has(...)` here — that's the stale closure from this render
      // and won't yet contain the entry we just added via setRenderCache.
      if (createdUrl && !handedOff) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [active?.key, app, eventId, cached]);

  // Revoke every cached blob URL on unmount via the ref above so we see
  // the latest cache contents.
  useEffect(() => {
    return () => {
      for (const entry of renderCacheRef.current.values()) {
        URL.revokeObjectURL(entry.blobUrl);
      }
    };
  }, []);

  const handleDownload = async () => {
    if (!active || !cached) return;
    setExporting(true);
    try {
      const safeName = active.speaker.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
      const filename = `${active.slide.label}_${safeName}.png`;
      // Sandboxed iframes block <a download> / window.open. Hand the bytes
      // back to the host via the MCP App SDK's downloadFile bridge — the
      // host shows its own download confirmation and writes the file.
      const result = await app.downloadFile({
        contents: [
          {
            type: "resource",
            resource: {
              uri: `file:///${filename}`,
              mimeType: cached.mimeType,
              blob: bytesToBase64(cached.bytes),
            },
          },
        ],
      });
      if (result.isError) {
        setActiveBlobError("Download was denied or cancelled");
      }
    } catch (err) {
      console.error("[SlidesPreview] download failed:", err);
      setActiveBlobError(formatErr(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-claude-dark text-claude-cream">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Slides preview</h2>
          <p className="text-xs text-claude-cream/60">
            Event {eventId} · {slides.length} slide template{slides.length === 1 ? "" : "s"} ·{" "}
            {speakers.length} speaker{speakers.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!cached || exporting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-coral-dark disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PNG
        </button>
      </header>

      {(error || activeBlobError) && (
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          <span>{error || activeBlobError}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setActiveBlobError(null);
            }}
            className="text-red-200/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-claude-cream/60" />
        ) : combos.length === 0 ? (
          <div className="max-w-md text-center text-sm text-claude-cream/60">
            <p>No slides to preview yet.</p>
            <p className="mt-2 text-xs">
              You need at least one slide template (the in-app slide generator saves these) and at
              least one speaker on this event.
            </p>
          </div>
        ) : active ? (
          <div className="flex h-full w-full max-w-5xl items-center gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + combos.length) % combos.length)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-claude-cream/70 hover:bg-white/10"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
              <div
                className="w-full max-w-[1000px] overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl"
                style={{ aspectRatio: aspectStyle(active.slide.template.aspect_ratio) }}
              >
                {cached ? (
                  // biome-ignore lint/performance/noImgElement: blob URL preview, no Next image optimization needed
                  <img
                    src={cached.blobUrl}
                    alt={`${active.slide.label} — ${active.speaker.name}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {activeBlobLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-claude-cream/40" />
                    ) : (
                      <span className="text-xs text-claude-cream/40">No render yet</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs text-claude-cream/70">
                {active.slide.label} · {active.speaker.name}
                <span className="ml-2 text-claude-cream/40">
                  ({index + 1} / {combos.length})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % combos.length)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-claude-cream/70 hover:bg-white/10"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function aspectStyle(ratio: SlideTemplate["aspect_ratio"]): string {
  switch (ratio) {
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    case "4:3":
      return "4 / 3";
    case "1:1":
      return "1 / 1";
    default:
      return "16 / 9";
  }
}
