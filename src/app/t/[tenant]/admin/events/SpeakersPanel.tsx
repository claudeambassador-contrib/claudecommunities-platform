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
  Building2,
  Eraser,
  FileText,
  GripVertical,
  Loader2,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ImageCropperModal from "@/components/ImageCropperModal";
import {
  greyscaleAndUpload,
  removeBackgroundAndUpload,
} from "@/components/slide-generator/imageEffects";
import { SlideImage } from "@/components/slide-generator/SlideImage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/upload-client";

export interface EventSpeaker {
  id: string;
  eventId: string;
  order: number;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  talkDescriptionShort: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  submissionId: string | null;
}

interface Submission {
  id: string;
  name: string;
  email: string;
  title: string;
  description: string | null;
  bio: string | null;
  city: string | null;
  status: string;
  slidesUrl: string | null;
  slidesFileName: string | null;
}

interface Props {
  eventId: string;
}

export default function SpeakersPanel({ eventId }: Props) {
  const toast = useToast();
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showApplicantPicker, setShowApplicantPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventSpeaker | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/speakers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as EventSpeaker[];
        if (!cancelled) {
          setSpeakers(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load speakers:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const selected = speakers.find((s) => s.id === selectedId) ?? null;

  /** Best-effort extraction of `error` field from a JSON error response. */
  const extractError = async (res: Response): Promise<string> => {
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // not JSON
    }
    return `${res.status} ${res.statusText || "Request failed"}`;
  };

  const addSpeaker = async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New speaker" }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const created = (await res.json()) as EventSpeaker;
      setSpeakers((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      console.error("Failed to add speaker:", err);
      toast.error("Failed to add speaker", err instanceof Error ? err.message : String(err));
    }
  };

  const addFromSubmission = async (submissionId: string) => {
    setShowApplicantPicker(false);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/speakers/from-submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const created = (await res.json()) as EventSpeaker;
      setSpeakers((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      console.error("Failed to import from submission:", err);
      toast.error(
        "Failed to import speaker from submission",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const removeSpeaker = async (id: string) => {
    const prev = speakers;
    setSpeakers((p) => p.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/speakers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await extractError(res));
    } catch (err) {
      console.error("Failed to remove speaker:", err);
      setSpeakers(prev);
      toast.error("Failed to delete speaker", err instanceof Error ? err.message : String(err));
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: extractError is a stable pure helper with no closure deps; listing it would needlessly churn this callback's identity on every render
  const updateSpeaker = useCallback(
    async (id: string, patch: Partial<EventSpeaker>) => {
      setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      try {
        const res = await fetch(`/api/admin/events/${eventId}/speakers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(await extractError(res));
        const updated = (await res.json()) as EventSpeaker;
        setSpeakers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      } catch (err) {
        console.error("Failed to update speaker:", err);
        toast.error("Failed to save changes", err instanceof Error ? err.message : String(err));
      }
    },
    [eventId, toast],
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = speakers.findIndex((s) => s.id === active.id);
    const newIndex = speakers.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(speakers, oldIndex, newIndex);
    const prev = speakers;
    setSpeakers(moved.map((s, i) => ({ ...s, order: i })));
    try {
      const res = await fetch(`/api/admin/events/${eventId}/speakers/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: moved.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error(await extractError(res));
    } catch (err) {
      console.error("Reorder failed:", err);
      setSpeakers(prev);
      toast.error("Failed to reorder speakers", err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-12 gap-0 overflow-hidden">
      {/* Speaker list */}
      <div className="col-span-4 border-r border-[#333] flex flex-col min-h-0">
        <div className="p-4 border-b border-[#333] flex items-center justify-between flex-shrink-0">
          <h3 className="text-white font-medium">Speakers</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowApplicantPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-gray-200 rounded-lg text-sm"
              title="Pre-fill from an existing speaker submission"
            >
              <UserPlus className="w-4 h-4 text-[#E07A5F]" /> From submission
            </button>
            <button
              type="button"
              onClick={addSpeaker}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E07A5F] hover:bg-[#c96a52] text-white rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : speakers.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">
              No speakers yet. Click <span className="text-[#E07A5F]">+ Add</span> or import from a
              submission.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={speakers.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {speakers.map((speaker) => (
                    <SpeakerRow
                      key={speaker.id}
                      speaker={speaker}
                      selected={selectedId === speaker.id}
                      onSelect={() => setSelectedId(speaker.id)}
                      onDelete={() => setDeleteTarget(speaker)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Edit pane */}
      <div className="col-span-8 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <SpeakerEditor
              key={selected.id}
              speaker={selected}
              onChange={(patch) => updateSpeaker(selected.id, patch)}
            />
          ) : (
            <div className="p-8 text-center text-gray-500 text-sm">
              Select a speaker to edit, or add one to get started. Speakers added here can be
              selected from the Agenda tab and feed the Slide Generator.
            </div>
          )}
        </div>
      </div>

      {showApplicantPicker && (
        <ApplicantPickerModal
          onClose={() => setShowApplicantPicker(false)}
          onPick={addFromSubmission}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        variant="destructive"
        title="Remove speaker?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed. Any agenda slots linked to them will be unlinked but kept.`
            : undefined
        }
        confirmLabel="Remove"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await removeSpeaker(id);
        }}
      />
    </div>
  );
}

function SpeakerRow({
  speaker,
  selected,
  onSelect,
  onDelete,
}: {
  speaker: EventSpeaker;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: speaker.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[#2a2a2a] rounded-lg border ${selected ? "border-[#E07A5F]" : "border-[#333]"} flex items-stretch group`}
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
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left py-2 pr-2 min-w-0 flex items-center gap-2"
      >
        <div className="w-8 h-8 rounded-full bg-[#333] overflow-hidden flex items-center justify-center shrink-0">
          {speaker.headshotUrl ? (
            <SlideImage
              src={speaker.headshotUrl}
              alt={speaker.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs text-gray-500 font-medium">
              {speaker.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-white text-sm truncate">{speaker.name || "Untitled speaker"}</div>
          <div className="text-xs text-gray-500 truncate">
            {speaker.talkTitle ||
              [speaker.title, speaker.company].filter(Boolean).join(", ") ||
              "No talk title"}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large cohesive form component; the complexity is incidental JSX branching for image/effect states, splitting it would obscure the single edit form
function SpeakerEditor({
  speaker,
  onChange,
}: {
  speaker: EventSpeaker;
  onChange: (patch: Partial<EventSpeaker>) => void;
}) {
  const toast = useToast();
  // Local controlled values for snappier typing; flush on blur.
  const [name, setName] = useState(speaker.name);
  const [title, setTitle] = useState(speaker.title ?? "");
  const [company, setCompany] = useState(speaker.company ?? "");
  const [bio, setBio] = useState(speaker.bio ?? "");
  const [talkTitle, setTalkTitle] = useState(speaker.talkTitle ?? "");
  const [talkDescription, setTalkDescription] = useState(speaker.talkDescription ?? "");
  const [talkDescriptionShort, setTalkDescriptionShort] = useState(
    speaker.talkDescriptionShort ?? "",
  );
  const [twitter, setTwitter] = useState(speaker.twitterHandle ?? "");
  const [linkedin, setLinkedin] = useState(speaker.linkedinUrl ?? "");
  const [website, setWebsite] = useState(speaker.websiteUrl ?? "");

  // biome-ignore lint/correctness/useExhaustiveDependencies: only reseed local state when switching to a different speaker
  useEffect(() => {
    setName(speaker.name);
    setTitle(speaker.title ?? "");
    setCompany(speaker.company ?? "");
    setBio(speaker.bio ?? "");
    setTalkTitle(speaker.talkTitle ?? "");
    setTalkDescription(speaker.talkDescription ?? "");
    setTalkDescriptionShort(speaker.talkDescriptionShort ?? "");
    setTwitter(speaker.twitterHandle ?? "");
    setLinkedin(speaker.linkedinUrl ?? "");
    setWebsite(speaker.websiteUrl ?? "");
  }, [speaker.id]);

  const flushIfChanged = useCallback(
    <K extends keyof EventSpeaker>(key: K, value: EventSpeaker[K]) => {
      if ((speaker[key] ?? "") !== (value ?? ""))
        onChange({ [key]: value } as Partial<EventSpeaker>);
    },
    [speaker, onChange],
  );

  const headshotRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<"headshot" | "logo">("headshot");
  const [uploading, setUploading] = useState(false);
  const [effect, setEffect] = useState<"removeBg" | "greyscale" | null>(null);
  const [effectError, setEffectError] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>, target: "headshot" | "logo") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropTarget(target);
    setCropFile(file);
    e.target.value = "";
  };

  const handleCropConfirm = async (cropped: File) => {
    setCropFile(null);
    setUploading(true);
    try {
      const folder = cropTarget === "headshot" ? "speaker-headshots" : "speaker-logos";
      const { url } = await uploadFile(cropped, { folder });
      if (cropTarget === "headshot") onChange({ headshotUrl: url });
      else onChange({ companyLogoUrl: url });
    } catch (err) {
      console.error("Speaker image upload failed:", err);
      toast.error("Failed to upload image", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!speaker.headshotUrl || effect) return;
    setEffect("removeBg");
    setEffectError(null);
    try {
      const { url } = await removeBackgroundAndUpload(speaker.headshotUrl, uploadFile);
      onChange({ headshotUrl: url });
    } catch (err) {
      console.error("Background removal failed:", err);
      setEffectError("Background removal failed");
    } finally {
      setEffect(null);
    }
  };

  const handleGreyscale = async () => {
    if (!speaker.headshotUrl || effect) return;
    setEffect("greyscale");
    setEffectError(null);
    try {
      const { url } = await greyscaleAndUpload(speaker.headshotUrl, uploadFile);
      onChange({ headshotUrl: url });
    } catch (err) {
      console.error("Greyscale failed:", err);
      setEffectError("Greyscale failed");
    } finally {
      setEffect(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="w-32">
          <label htmlFor="speaker-headshot-input" className="block text-xs text-gray-400 mb-1">
            Headshot
          </label>
          <input
            id="speaker-headshot-input"
            ref={headshotRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onSelectFile(e, "headshot")}
          />
          {speaker.headshotUrl ? (
            <div className="relative group">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-[#2a2a2a] border border-[#444]">
                <SlideImage
                  src={speaker.headshotUrl}
                  alt={speaker.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => headshotRef.current?.click()}
                  disabled={uploading || effect !== null}
                  className="text-white text-xs px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ headshotUrl: null })}
                  disabled={effect !== null}
                  className="text-white text-xs px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {effect && (
                <div className="absolute inset-0 bg-black/75 rounded-lg flex flex-col items-center justify-center gap-2 text-white text-[10px] text-center px-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {effect === "removeBg"
                    ? "Removing background…\nFirst use downloads ~40 MB of model"
                    : "Converting to greyscale…"}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => headshotRef.current?.click()}
              disabled={uploading}
              className="w-32 h-32 rounded-lg border-2 border-dashed border-[#444] hover:border-[#E07A5F] bg-[#2a2a2a] flex flex-col items-center justify-center gap-1 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-gray-500" />
              )}
              <span className="text-[10px] text-gray-500">
                {uploading ? "Uploading…" : "Upload"}
              </span>
            </button>
          )}
          {speaker.headshotUrl && (
            <div className="flex gap-1 mt-1.5">
              <button
                type="button"
                onClick={handleRemoveBackground}
                disabled={uploading || effect !== null}
                className="flex-1 inline-flex items-center justify-center gap-1 px-1 h-7 rounded text-[10px] text-gray-300 hover:text-white bg-[#2a2a2a] hover:bg-[#333] border border-[#444] disabled:opacity-50"
                title="Remove background — first use downloads ~40 MB"
              >
                <Eraser className="w-3 h-3" />
                Remove bg
              </button>
              <button
                type="button"
                onClick={handleGreyscale}
                disabled={uploading || effect !== null}
                className="flex-1 inline-flex items-center justify-center gap-1 px-1 h-7 rounded text-[10px] text-gray-300 hover:text-white bg-[#2a2a2a] hover:bg-[#333] border border-[#444] disabled:opacity-50"
                title="Convert to greyscale"
              >
                <Palette className="w-3 h-3" />
                Greyscale
              </button>
            </div>
          )}
          {effectError && <div className="text-[10px] text-red-300/80 mt-1">{effectError}</div>}
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          <div>
            <label htmlFor="speaker-name-input" className="block text-xs text-gray-400 mb-1">
              Speaker name *
            </label>
            <input
              id="speaker-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => flushIfChanged("name", name)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
              placeholder="Jane Smith"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="speaker-title-input" className="block text-xs text-gray-400 mb-1">
                Title / role
              </label>
              <input
                id="speaker-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => flushIfChanged("title", title || null)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                placeholder="Senior Engineer"
              />
            </div>
            <div>
              <label htmlFor="speaker-company-input" className="block text-xs text-gray-400 mb-1">
                Company
              </label>
              <input
                id="speaker-company-input"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onBlur={() => flushIfChanged("company", company || null)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                placeholder="Anthropic"
              />
            </div>
          </div>
          <div>
            <label htmlFor="speaker-bio-input" className="block text-xs text-gray-400 mb-1">
              Speaker bio (markdown)
            </label>
            <textarea
              id="speaker-bio-input"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => flushIfChanged("bio", bio || null)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white font-mono"
              placeholder="Markdown supported: **bold**, _italic_, [link](https://…)"
            />
          </div>
        </div>
      </div>

      {speaker.submissionId && <LinkedSubmissionPanel submissionId={speaker.submissionId} />}

      <div className="border-t border-[#333] pt-3 space-y-3">
        <h4 className="text-white font-medium text-sm">Talk</h4>
        <div>
          <label htmlFor="speaker-talk-title-input" className="block text-xs text-gray-400 mb-1">
            Talk title
          </label>
          <input
            id="speaker-talk-title-input"
            type="text"
            value={talkTitle}
            onChange={(e) => setTalkTitle(e.target.value)}
            onBlur={() => flushIfChanged("talkTitle", talkTitle || null)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
            placeholder="Building the Future of APIs"
          />
        </div>
        <div>
          <label htmlFor="speaker-talk-desc-input" className="block text-xs text-gray-400 mb-1">
            Talk description (markdown)
          </label>
          <textarea
            id="speaker-talk-desc-input"
            rows={4}
            value={talkDescription}
            onChange={(e) => setTalkDescription(e.target.value)}
            onBlur={() => flushIfChanged("talkDescription", talkDescription || null)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white font-mono"
            placeholder="A brief description of the talk…"
          />
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            disabled={!talkDescription.trim()}
            title={
              talkDescription.trim()
                ? "Generate a short description from the talk description"
                : "Add a talk description first"
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-gray-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 text-[#E07A5F]" /> Generate short description
          </button>
        </div>
        <div>
          <label htmlFor="speaker-talk-short-input" className="block text-xs text-gray-400 mb-1">
            Short description (slides)
            <span className="ml-1 text-gray-500">— ~1 line, falls back to the long version</span>
          </label>
          <textarea
            id="speaker-talk-short-input"
            rows={2}
            value={talkDescriptionShort}
            onChange={(e) => setTalkDescriptionShort(e.target.value)}
            onBlur={() => flushIfChanged("talkDescriptionShort", talkDescriptionShort || null)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
            placeholder="One-line teaser sized for the speaker slide"
          />
        </div>
      </div>

      <div className="border-t border-[#333] pt-3 space-y-3">
        <h4 className="text-white font-medium text-sm">Branding & socials</h4>
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
          <div className="w-32">
            <label htmlFor="speaker-logo-input" className="block text-xs text-gray-400 mb-1">
              Company logo
            </label>
            <input
              id="speaker-logo-input"
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onSelectFile(e, "logo")}
            />
            {speaker.companyLogoUrl ? (
              <div className="relative group">
                <div className="w-32 h-32 rounded-lg bg-[#2a2a2a] border border-[#444] flex items-center justify-center p-3">
                  <SlideImage
                    src={speaker.companyLogoUrl}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    disabled={uploading}
                    className="text-white text-xs px-2 py-1 rounded hover:bg-white/10"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ companyLogoUrl: null })}
                    className="text-white text-xs px-2 py-1 rounded hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={uploading}
                className="w-32 h-32 rounded-lg border-2 border-dashed border-[#444] hover:border-[#E07A5F] bg-[#2a2a2a] flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Building2 className="w-5 h-5 text-gray-500" />
                <span className="text-[10px] text-gray-500">Upload</span>
              </button>
            )}
          </div>

          <div className="space-y-3 flex-1 min-w-0">
            <div>
              <label htmlFor="speaker-twitter-input" className="block text-xs text-gray-400 mb-1">
                Twitter / X handle
              </label>
              <input
                id="speaker-twitter-input"
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                onBlur={() => flushIfChanged("twitterHandle", twitter || null)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                placeholder="@handle"
              />
            </div>
            <div>
              <label htmlFor="speaker-linkedin-input" className="block text-xs text-gray-400 mb-1">
                LinkedIn URL
              </label>
              <input
                id="speaker-linkedin-input"
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                onBlur={() => flushIfChanged("linkedinUrl", linkedin || null)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                placeholder="linkedin.com/in/username"
              />
            </div>
            <div>
              <label htmlFor="speaker-website-input" className="block text-xs text-gray-400 mb-1">
                Website
              </label>
              <input
                id="speaker-website-input"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onBlur={() => flushIfChanged("websiteUrl", website || null)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
                placeholder="example.com"
              />
            </div>
          </div>
        </div>
      </div>

      {cropFile && (
        <ImageCropperModal
          file={cropFile}
          aspect={1}
          outputSize={cropTarget === "headshot" ? 1024 : 512}
          cropShape={cropTarget === "headshot" ? "round" : "rect"}
          title={cropTarget === "headshot" ? "Crop headshot" : "Crop logo"}
          onCancel={() => setCropFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      {showGenerateModal && (
        <GenerateShortDescriptionModal
          eventId={speaker.eventId}
          speakerId={speaker.id}
          speakerName={speaker.name || "this speaker"}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(shortDescription) => {
            setTalkDescriptionShort(shortDescription);
            onChange({ talkDescriptionShort: shortDescription });
            setShowGenerateModal(false);
            toast.success("Short description generated");
          }}
        />
      )}
    </div>
  );
}

function GenerateShortDescriptionModal({
  eventId,
  speakerId,
  speakerName,
  onClose,
  onGenerated,
}: {
  eventId: string;
  speakerId: string;
  speakerName: string;
  onClose: () => void;
  onGenerated: (shortDescription: string) => void;
}) {
  const toast = useToast();
  const [focus, setFocus] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const trimmed = focus.trim();
      const res = await fetch(
        `/api/admin/events/${eventId}/speakers/${speakerId}/generate-short-description`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trimmed ? { focus: trimmed } : {}),
        },
      );
      if (!res.ok) {
        let message = `${res.status} ${res.statusText || "Request failed"}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // not JSON
        }
        toast.error("Failed to generate", message);
        return;
      }
      const data = (await res.json()) as { shortDescription: string };
      onGenerated(data.shortDescription);
    } catch (err) {
      toast.error("Failed to generate", err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#1f1f1f] rounded-xl w-full max-w-md flex flex-col border border-[#333]">
        <div className="px-5 py-3 border-b border-[#333] flex items-center justify-between">
          <h3 className="text-white font-semibold">Generate short description</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-gray-400">
            From the talk description of <span className="text-gray-200">{speakerName}</span>
          </div>
          <div>
            <label htmlFor="speaker-focus-input" className="block text-xs text-gray-400 mb-1">
              Focus (optional)
            </label>
            <textarea
              id="speaker-focus-input"
              rows={2}
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={generating}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white disabled:opacity-50"
              placeholder="e.g. focus on the developer experience angle"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#333] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-gray-200 rounded-lg text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E07A5F] hover:bg-[#c96a52] text-white rounded-lg text-sm disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplicantPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (submissionId: string) => void;
}) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending">("approved");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/speakers");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSubs(data.submissions || []);
      } catch (err) {
        console.error("Failed to load applicants:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = subs.filter((s) => statusFilter === "all" || s.status === statusFilter);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#1f1f1f] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-[#333]">
        <div className="px-5 py-3 border-b border-[#333] flex items-center justify-between">
          <h3 className="text-white font-semibold">Pre-fill from speaker submission</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-2 border-b border-[#333] flex gap-2 text-xs">
          {(["approved", "pending", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded ${statusFilter === s ? "bg-[#E07A5F] text-white" : "bg-[#2a2a2a] text-gray-400"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-12 text-sm">No submissions found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPick(s.id)}
                  className="w-full text-left p-3 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-white text-sm font-medium flex-1 truncate">{s.name}</div>
                    {s.slidesUrl && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#E07A5F]/15 text-[#E07A5F]"
                        title={s.slidesFileName ?? "Slides uploaded"}
                      >
                        slides
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{s.title}</div>
                  {s.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Surface the linked TalkSubmission's slides + original description for an
 * event speaker that was promoted from one. Slides stay on the submission;
 * we just render the link here so the admin can grab them.
 */
function LinkedSubmissionPanel({ submissionId }: { submissionId: string }) {
  const [submission, setSubmission] = useState<{
    title: string;
    description: string | null;
    slidesUrl: string | null;
    slidesFileName: string | null;
    contentLocked: boolean;
    slidesLocked: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/talks/${submissionId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { talk: typeof submission };
        if (!cancelled) setSubmission(data.talk);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (error) return null;
  if (!submission) return null;

  return (
    <div className="border-t border-[#333] pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium text-sm">From submission</h4>
        <a
          href={`/admin/speakers`}
          className="text-xs text-[#E07A5F] hover:underline"
          title="Open in submissions admin"
        >
          Manage →
        </a>
      </div>
      {submission.slidesUrl ? (
        <a
          href={submission.slidesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] border border-[#444] rounded-lg text-sm text-white"
        >
          <FileText className="w-4 h-4 text-[#E07A5F]" />
          {submission.slidesFileName ?? "View speaker slides"}
        </a>
      ) : (
        <p className="text-xs text-gray-500">Speaker hasn&apos;t uploaded slides yet.</p>
      )}
      {submission.description && (
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-white">
            Original talk description
          </summary>
          <p className="mt-1 text-gray-300 whitespace-pre-wrap pl-2 border-l border-[#444]">
            {submission.description}
          </p>
        </details>
      )}
    </div>
  );
}
