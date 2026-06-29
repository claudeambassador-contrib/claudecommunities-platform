"use client";

import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Layers,
  Linkedin,
  Loader2,
  Send,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { useToast } from "@/components/ui/Toast";
import type {
  SocialAccountSummary,
  SocialMediaType,
  SocialPlatform,
  SocialPostSummary,
} from "@/lib/social/types";
import { resizeImage, type UploadResult, uploadFile } from "@/lib/upload-client";

interface Props {
  accounts: SocialAccountSummary[];
  existing: SocialPostSummary | null;
  onClose: () => void;
  onSaved: (action: "draft" | "scheduled" | "publish") => void;
}

interface MediaSlot {
  url: string;
  mimeType: string;
}

const MAX_TEXT = 3000;

// Determine which media types are allowed per platform. Keeps the composer
// honest if a future platform doesn't support one of the shapes.
function allowedMediaTypes(_platform: SocialPlatform): SocialMediaType[] {
  // For now, only LinkedIn — all five types are supported.
  return ["none", "image", "multi_image", "video", "document"];
}

function platformIcon(platform: SocialPlatform) {
  if (platform === "linkedin") return <Linkedin className="w-4 h-4" />;
  return null;
}

function mediaTypeFromUploads(uploads: MediaSlot[], current: SocialMediaType): SocialMediaType {
  if (uploads.length === 0) return current === "document" ? "document" : "none";
  if (current === "document") return "document";
  if (current === "video") return "video";
  if (uploads.length === 1) return "image";
  return "multi_image";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: composer interleaves many state hooks with a large JSX form; restructuring in a lint pass risks TDZ/behavior changes
export function PostComposer({ accounts, existing, onClose, onSaved }: Props) {
  const toast = useToast();
  const linkedInAccounts = accounts.filter((a) => a.platform === "linkedin");

  const [accountId, setAccountId] = useState<string>(
    existing?.accountId ?? linkedInAccounts[0]?.id ?? "",
  );
  const [platform] = useState<SocialPlatform>("linkedin");
  const [content, setContent] = useState(existing?.content ?? "");
  const [mediaType, setMediaType] = useState<SocialMediaType>(existing?.mediaType ?? "none");
  const [media, setMedia] = useState<MediaSlot[]>(
    (existing?.mediaUrls ?? []).map((url) => ({ url, mimeType: guessMime(url) })),
  );
  const [scheduledAt, setScheduledAt] = useState<string>(
    existing?.scheduledAt ? toLocalDatetime(existing.scheduledAt) : defaultScheduleLocal(),
  );
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">(
    existing?.scheduledAt ? "later" : "now",
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"draft" | "scheduled" | "publish" | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const allowed = useMemo(() => allowedMediaTypes(platform), [platform]);
  const remaining = MAX_TEXT - content.length;

  const validateAndPick = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      // Filter by selected mediaType.
      let accept: (f: File) => boolean;
      if (mediaType === "video") accept = (f) => f.type.startsWith("video/");
      else if (mediaType === "document") accept = (f) => f.type === "application/pdf";
      else accept = (f) => f.type.startsWith("image/");
      const filtered = list.filter(accept);
      if (filtered.length === 0) {
        toast.error("No matching files for this post type.");
        return;
      }
      return filtered;
    },
    [mediaType, toast],
  );

  const handleUpload = useCallback(
    async (raw: FileList | null) => {
      const files = validateAndPick(raw);
      if (!files) return;
      setUploading(true);
      try {
        const uploaded: MediaSlot[] = [];
        for (const f of files) {
          const file = f.type.startsWith("image/") ? await resizeImage(f, 2000) : f;
          const result: UploadResult = await uploadFile(file, { folder: "social" });
          uploaded.push({ url: result.url, mimeType: f.type });
        }
        // Derive next media + type in one pass so the type stays in sync.
        setMedia((prev) => {
          // Video/document are single-file; image and multi_image accumulate
          // (capped at 10). mediaTypeFromUploads then promotes 2+ images to
          // multi_image.
          const next =
            mediaType === "video" || mediaType === "document"
              ? uploaded.slice(0, 1)
              : [...prev, ...uploaded].slice(0, 10);
          // Schedule the type update from the same source-of-truth.
          setMediaType((prevType) => mediaTypeFromUploads(next, prevType));
          return next;
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [mediaType, toast, validateAndPick],
  );

  const removeMedia = (i: number) => {
    setMedia((prev) => prev.filter((_, idx) => idx !== i));
  };

  const moveMedia = (i: number, dir: -1 | 1) => {
    setMedia((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validation + payload-shaping + two-phase publish flow; extracting helpers in a lint pass is not behavior-safe
  const save = async (action: "draft" | "scheduled" | "publish") => {
    if (!accountId) {
      toast.error("Pick a connected account first.");
      return;
    }
    if (!content.trim() && mediaType === "none") {
      toast.error("Add content or media first.");
      return;
    }
    if (action === "scheduled" && !scheduledAt) {
      toast.error("Pick a scheduled time.");
      return;
    }
    const finalMediaType: SocialMediaType =
      mediaType === "video" || mediaType === "document"
        ? mediaType
        : media.length === 0
          ? "none"
          : media.length === 1
            ? "image"
            : "multi_image";

    setBusy(action);
    try {
      const payload = {
        accountId,
        content,
        mediaType: finalMediaType,
        mediaUrls: media.map((m) => m.url),
        scheduledAt: action === "scheduled" ? new Date(scheduledAt).toISOString() : undefined,
        action,
      };
      const url = existing ? `/api/admin/social/posts/${existing.id}` : "/api/admin/social/posts";
      const method = existing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing ? toPatch(payload, action) : payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      // For existing posts: if user wants "publish", call the dedicated endpoint
      // since PATCH doesn't trigger publishing.
      if (existing && action === "publish") {
        const pubRes = await fetch(`/api/admin/social/posts/${existing.id}/publish`, {
          method: "POST",
        });
        if (!pubRes.ok) {
          const data = (await pubRes.json()) as { error?: string };
          throw new Error(data.error ?? "Publish failed");
        }
      }
      onSaved(action);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop close-on-click; keyboard close is provided by the global Escape handler above
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal is keyboard-accessible via the global Escape handler
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      onClick={() => !busy && !uploading && onClose()}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops backdrop-close propagation only; not an interactive control */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops propagation, no action to mirror on keyboard */}
      <div
        className="bg-[#1F1B17] border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">
            {existing ? "Edit post" : "New social post"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!!busy}
            className="p-1 text-[#78716C] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Account picker */}
          <Section label="Post to">
            <div className="space-y-2">
              {linkedInAccounts.length === 0 && (
                <p className="text-sm text-amber-300">
                  No LinkedIn accounts connected. Connect one from Settings.
                </p>
              )}
              {linkedInAccounts.map((acc) => (
                <label
                  key={acc.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    accountId === acc.id
                      ? "border-[#D4836A] bg-[#D4836A]/10"
                      : "border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  <input
                    type="radio"
                    name="account"
                    value={acc.id}
                    checked={accountId === acc.id}
                    onChange={() => setAccountId(acc.id)}
                    className="sr-only"
                  />
                  <div className="text-[#7CB8F0]">{platformIcon(acc.platform)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-white flex items-center gap-2">
                      {acc.displayName}
                      {acc.connector === "zernio" && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.05] text-[#A8A29E]">
                          via Zernio
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#78716C]">{acc.accountType}</p>
                  </div>
                  {accountId === acc.id && <CheckCircle2 className="w-5 h-5 text-[#D4836A]" />}
                </label>
              ))}
            </div>
          </Section>

          {/* Media-type picker (also drives the file accept filter) */}
          <Section label="Post type">
            <div className="flex flex-wrap gap-2">
              <MediaTypeButton
                active={mediaType === "none"}
                onClick={() => {
                  setMediaType("none");
                  setMedia([]);
                }}
                disabled={!allowed.includes("none")}
              >
                Text only
              </MediaTypeButton>
              <MediaTypeButton
                active={mediaType === "image" || mediaType === "multi_image"}
                onClick={() => {
                  setMediaType(media.length > 1 ? "multi_image" : "image");
                }}
                disabled={!allowed.includes("image")}
                icon={<ImageIcon className="w-3.5 h-3.5" />}
              >
                Images
              </MediaTypeButton>
              <MediaTypeButton
                active={mediaType === "video"}
                onClick={() => {
                  setMediaType("video");
                  setMedia([]);
                }}
                disabled={!allowed.includes("video")}
                icon={<Video className="w-3.5 h-3.5" />}
              >
                Video
              </MediaTypeButton>
              <MediaTypeButton
                active={mediaType === "document"}
                onClick={() => {
                  setMediaType("document");
                  setMedia([]);
                }}
                disabled={!allowed.includes("document")}
                icon={<FileText className="w-3.5 h-3.5" />}
              >
                Carousel (PDF)
              </MediaTypeButton>
            </div>
            {mediaType === "document" && (
              <p className="text-xs text-[#78716C] mt-2">
                LinkedIn renders PDF documents as a swipeable carousel. Upload a single PDF.
              </p>
            )}
            {mediaType === "multi_image" && (
              <p className="text-xs text-[#78716C] mt-2">
                Multi-image posts display in a grid — not swipeable. For swipeable carousels, use
                the PDF type.
              </p>
            )}
          </Section>

          {/* Media uploader */}
          {mediaType !== "none" && (
            <Section label="Media">
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {media.map((m, i) => (
                    <MediaThumb
                      key={m.url}
                      slot={m}
                      mediaType={mediaType}
                      onRemove={() => removeMedia(i)}
                      onMoveLeft={i > 0 ? () => moveMedia(i, -1) : undefined}
                      onMoveRight={i < media.length - 1 ? () => moveMedia(i, 1) : undefined}
                    />
                  ))}
                </div>
              )}
              <label
                onDragOver={(e) => {
                  if (uploading) return;
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
                }}
                onDragLeave={(e) => {
                  // Only clear when the pointer actually leaves the label,
                  // not when it crosses a child element.
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (uploading) return;
                  void handleUpload(e.dataTransfer.files);
                }}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed text-sm cursor-pointer transition-colors ${
                  dragOver
                    ? "border-[#D4836A] bg-[#D4836A]/10 text-white"
                    : "border-white/[0.1] text-[#A8A29E] hover:border-white/[0.2] hover:text-white"
                } ${uploading ? "opacity-50 cursor-wait" : ""}`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading…
                  </>
                ) : dragOver ? (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    Drop to upload
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    {mediaType === "image" || mediaType === "multi_image"
                      ? `Click or drop image${mediaType === "multi_image" ? "s" : ""} here`
                      : mediaType === "video"
                        ? "Click or drop a video here"
                        : "Click or drop a PDF here"}
                  </>
                )}
                <input
                  type="file"
                  className="sr-only"
                  multiple={mediaType === "multi_image" || mediaType === "image"}
                  accept={
                    mediaType === "video"
                      ? "video/*"
                      : mediaType === "document"
                        ? "application/pdf"
                        : "image/*"
                  }
                  disabled={uploading}
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>
            </Section>
          )}

          {/* Content */}
          <Section label="Content">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={MAX_TEXT}
              placeholder="What do you want to share?"
              className="w-full px-3 py-2 rounded-lg bg-[#2D2926] border border-white/[0.06] text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 resize-y"
            />
            <p className="text-xs text-[#78716C] mt-1 text-right">{remaining} characters left</p>
          </Section>

          {/* Schedule */}
          <Section label="When">
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")}
                  className="text-[#D4836A]"
                />
                <span className="text-white">Publish now</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === "later"}
                  onChange={() => setScheduleMode("later")}
                  className="text-[#D4836A]"
                />
                <span className="text-white">Schedule</span>
              </label>
            </div>
            {scheduleMode === "later" && (
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#78716C]" />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#2D2926] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-[#D4836A]/50"
                />
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-white/[0.06] bg-[#1A1715]">
          <button
            type="button"
            onClick={() => save("draft")}
            disabled={!!busy}
            className="px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            {busy === "draft" ? "Saving…" : "Save draft"}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            {scheduleMode === "now" ? (
              <button
                type="button"
                onClick={() => save("publish")}
                disabled={!!busy || uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#D4836A] text-white hover:bg-[#C26F56] disabled:opacity-40"
              >
                {busy === "publish" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Publish now
              </button>
            ) : (
              <button
                type="button"
                onClick={() => save("scheduled")}
                disabled={!!busy || uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#D4836A] text-white hover:bg-[#C26F56] disabled:opacity-40"
              >
                {busy === "scheduled" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarClock className="w-4 h-4" />
                )}
                Schedule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#78716C] mb-2">{label}</p>
      {children}
    </div>
  );
}

function MediaTypeButton({
  active,
  disabled,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? "bg-[#D4836A]/15 text-[#D4836A] border-[#D4836A]/40"
          : "text-[#A8A29E] border-white/[0.06] hover:text-white hover:border-white/[0.12]"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {icon}
      {children}
    </button>
  );
}

function MediaThumb({
  slot,
  mediaType,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: {
  slot: MediaSlot;
  mediaType: SocialMediaType;
  onRemove: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}) {
  const isImage = slot.mimeType.startsWith("image/");
  const isVideo = slot.mimeType.startsWith("video/") || mediaType === "video";
  const isPdf = slot.mimeType === "application/pdf" || mediaType === "document";

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-[#2D2926] border border-white/[0.06] group">
      {isImage ? (
        <RemoteImage src={slot.url} alt="" className="w-full h-full object-cover" />
      ) : isVideo ? (
        <div className="w-full h-full flex items-center justify-center">
          <Video className="w-8 h-8 text-[#78716C]" />
        </div>
      ) : isPdf ? (
        <div className="w-full h-full flex items-center justify-center">
          <FileText className="w-8 h-8 text-[#78716C]" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Layers className="w-8 h-8 text-[#78716C]" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
      {(onMoveLeft || onMoveRight) && (
        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveLeft ? (
            <button
              type="button"
              onClick={onMoveLeft}
              className="px-1.5 py-0.5 text-xs rounded bg-black/60 text-white"
            >
              ←
            </button>
          ) : (
            <span />
          )}
          {onMoveRight ? (
            <button
              type="button"
              onClick={onMoveRight}
              className="px-1.5 py-0.5 text-xs rounded bg-black/60 text-white"
            >
              →
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}

function toPatch(
  p: {
    content: string;
    mediaType: SocialMediaType;
    mediaUrls: string[];
    scheduledAt?: string;
  },
  action: "draft" | "scheduled" | "publish",
) {
  // PATCH never includes "action" — that's a create-only flag.
  // We also adjust status:
  // - draft  → status: "draft"
  // - scheduled → status: "scheduled", scheduledAt set
  // - publish → leave status as-is; caller invokes /publish after
  const base: Record<string, unknown> = {
    content: p.content,
    mediaType: p.mediaType,
    mediaUrls: p.mediaUrls,
  };
  if (action === "draft") {
    base.status = "draft";
    base.scheduledAt = null;
  } else if (action === "scheduled") {
    base.status = "scheduled";
    base.scheduledAt = p.scheduledAt;
  }
  return base;
}

function guessMime(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}

function defaultScheduleLocal(): string {
  // Default to 1 hour from now, rounded to the next 15-minute mark.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return toLocalDatetime(d.toISOString());
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
