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
import type { App } from "@modelcontextprotocol/ext-apps";
import {
  Building2,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { callTool } from "../lib/callTool";
import { ResourceImage } from "../lib/ResourceImage";
import { uploadImage } from "../lib/uploadImage";

interface EventSpeaker {
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

interface Props {
  app: App;
  eventId: string;
  bearerToken?: string;
  origin?: string;
}

export function SpeakerManager({ app, eventId, bearerToken, origin }: Props) {
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await callTool<EventSpeaker[]>(app, "listEventSpeakers", { eventId });
        if (cancelled) return;
        setSpeakers(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // selectedId intentionally excluded — we only auto-select on first load
  }, [app, eventId]);

  const selected = speakers.find((s) => s.id === selectedId) ?? null;

  const addSpeaker = async () => {
    try {
      const created = await callTool<EventSpeaker>(app, "addEventSpeaker", {
        eventId,
        name: "New speaker",
      });
      setSpeakers((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeSpeaker = async (id: string) => {
    const prev = speakers;
    setSpeakers((p) => p.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      await callTool(app, "deleteEventSpeaker", { speakerId: id });
    } catch (err) {
      setSpeakers(prev);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const updateSpeaker = useCallback(
    async (id: string, patch: Partial<EventSpeaker>) => {
      setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      try {
        const updated = await callTool<EventSpeaker>(app, "updateEventSpeaker", {
          speakerId: id,
          ...patch,
        });
        setSpeakers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [app],
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
      await callTool(app, "reorderEventSpeakers", {
        eventId,
        speakerIds: moved.map((s) => s.id),
      });
    } catch (err) {
      setSpeakers(prev);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-claude-dark text-claude-cream">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Speakers</h2>
          <p className="text-xs text-claude-cream/60">Event {eventId}</p>
        </div>
        <button
          type="button"
          onClick={addSpeaker}
          className="inline-flex items-center gap-1.5 rounded-lg bg-claude-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-coral-dark"
        >
          <Plus className="h-4 w-4" /> Add speaker
        </button>
      </header>

      {error && (
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-200/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden">
        <div className="col-span-5 flex min-h-0 flex-col border-r border-white/10">
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-claude-cream/60">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : speakers.length === 0 ? (
              <div className="px-2 py-12 text-center text-sm text-claude-cream/60">
                No speakers yet. Click <span className="text-claude-coral">Add speaker</span> to
                create one.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={speakers.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {speakers.map((speaker) => (
                      <SpeakerRow
                        key={speaker.id}
                        app={app}
                        speaker={speaker}
                        selected={selectedId === speaker.id}
                        onSelect={() => setSelectedId(speaker.id)}
                        onDelete={() => removeSpeaker(speaker.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <div className="col-span-7 flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <SpeakerEditor
                key={selected.id}
                app={app}
                speaker={selected}
                onChange={(patch) => updateSpeaker(selected.id, patch)}
                bearerToken={bearerToken}
                origin={origin}
                onError={(msg) => setError(msg)}
              />
            ) : (
              <div className="p-8 text-center text-sm text-claude-cream/60">
                Select a speaker on the left or add one to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpeakerRow({
  app,
  speaker,
  selected,
  onSelect,
  onDelete,
}: {
  app: App;
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
      className={`group flex items-stretch rounded-lg border bg-claude-dark-card ${
        selected ? "border-claude-coral" : "border-white/10"
      }`}
    >
      <button
        type="button"
        className="flex cursor-grab items-center px-2 text-claude-cream/40 hover:text-claude-cream"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5">
          <ResourceImage
            app={app}
            url={speaker.headshotUrl}
            alt={speaker.name}
            className="h-full w-full object-cover"
            fallback={
              <span className="text-xs font-medium text-claude-cream/50">
                {speaker.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?"}
              </span>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{speaker.name || "Untitled speaker"}</div>
          <div className="truncate text-xs text-claude-cream/50">
            {speaker.talkTitle ||
              [speaker.title, speaker.company].filter(Boolean).join(", ") ||
              "No talk title"}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-2 text-claude-cream/40 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SpeakerEditor({
  app,
  speaker,
  onChange,
  bearerToken,
  origin,
  onError,
}: {
  app: App;
  speaker: EventSpeaker;
  onChange: (patch: Partial<EventSpeaker>) => void;
  bearerToken?: string;
  origin?: string;
  onError: (msg: string) => void;
}) {
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
  const [uploading, setUploading] = useState<"headshot" | "logo" | null>(null);

  const handleSelectFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "headshot" | "logo",
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!bearerToken || !origin) {
      onError("Upload unavailable: missing host bearer token or origin");
      return;
    }
    setUploading(target);
    try {
      const folder = target === "headshot" ? "speakers/headshots" : "speakers/logos";
      const { url } = await uploadImage({ file, folder, origin, bearerToken });
      if (target === "headshot") onChange({ headshotUrl: url });
      else onChange({ companyLogoUrl: url });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-5 p-4 text-sm">
      <div className="grid grid-cols-[auto_1fr] items-start gap-4">
        <div className="w-32">
          <label htmlFor="speaker-headshot" className="mb-1 block text-xs text-claude-cream/60">
            Headshot
          </label>
          <input
            id="speaker-headshot"
            ref={headshotRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleSelectFile(e, "headshot")}
          />
          {speaker.headshotUrl ? (
            <div className="group relative">
              <div className="h-32 w-32 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <ResourceImage
                  app={app}
                  url={speaker.headshotUrl}
                  alt={speaker.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => headshotRef.current?.click()}
                  disabled={uploading !== null}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white hover:bg-white/10"
                >
                  <Upload className="h-3 w-3" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ headshotUrl: null })}
                  className="rounded px-2 py-1 text-xs text-white hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => headshotRef.current?.click()}
              disabled={uploading !== null}
              className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/15 bg-white/5 transition-colors hover:border-claude-coral"
            >
              {uploading === "headshot" ? (
                <Loader2 className="h-5 w-5 animate-spin text-claude-cream/60" />
              ) : (
                <Upload className="h-5 w-5 text-claude-cream/60" />
              )}
              <span className="text-[10px] text-claude-cream/60">
                {uploading === "headshot" ? "Uploading…" : "Upload"}
              </span>
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <Field label="Speaker name *">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => flushIfChanged("name", name)}
              placeholder="Jane Smith"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title / role">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => flushIfChanged("title", title || null)}
                placeholder="Senior Engineer"
                className={inputCls}
              />
            </Field>
            <Field label="Company">
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onBlur={() => flushIfChanged("company", company || null)}
                placeholder="Anthropic"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Speaker bio (markdown)">
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => flushIfChanged("bio", bio || null)}
              placeholder="Markdown supported"
              className={`${inputCls} font-mono`}
            />
          </Field>
        </div>
      </div>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium">Talk</h3>
        <Field label="Talk title">
          <input
            type="text"
            value={talkTitle}
            onChange={(e) => setTalkTitle(e.target.value)}
            onBlur={() => flushIfChanged("talkTitle", talkTitle || null)}
            placeholder="Building the Future of APIs"
            className={inputCls}
          />
        </Field>
        <Field label="Talk description (markdown)">
          <textarea
            rows={4}
            value={talkDescription}
            onChange={(e) => setTalkDescription(e.target.value)}
            onBlur={() => flushIfChanged("talkDescription", talkDescription || null)}
            placeholder="A brief description of the talk…"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Short description (slides) — ~1 line, falls back to the long version">
          <textarea
            rows={2}
            value={talkDescriptionShort}
            onChange={(e) => setTalkDescriptionShort(e.target.value)}
            onBlur={() =>
              flushIfChanged("talkDescriptionShort", talkDescriptionShort || null)
            }
            placeholder="One-line teaser sized for the speaker slide"
            className={inputCls}
          />
        </Field>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium">Branding & socials</h3>
        <div className="grid grid-cols-[auto_1fr] items-start gap-4">
          <div className="w-32">
            <label htmlFor="speaker-logo" className="mb-1 block text-xs text-claude-cream/60">
              Company logo
            </label>
            <input
              id="speaker-logo"
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleSelectFile(e, "logo")}
            />
            {speaker.companyLogoUrl ? (
              <div className="group relative">
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-3">
                  <ResourceImage
                    app={app}
                    url={speaker.companyLogoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    disabled={uploading !== null}
                    className="rounded px-2 py-1 text-xs text-white hover:bg-white/10"
                  >
                    <Upload className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ companyLogoUrl: null })}
                    className="rounded px-2 py-1 text-xs text-white hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={uploading !== null}
                className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/15 bg-white/5 transition-colors hover:border-claude-coral"
              >
                {uploading === "logo" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-claude-cream/60" />
                ) : (
                  <Building2 className="h-5 w-5 text-claude-cream/60" />
                )}
                <span className="text-[10px] text-claude-cream/60">
                  {uploading === "logo" ? "Uploading…" : "Upload"}
                </span>
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <Field label="Twitter / X handle">
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                onBlur={() => flushIfChanged("twitterHandle", twitter || null)}
                placeholder="@handle"
                className={inputCls}
              />
            </Field>
            <Field label="LinkedIn URL">
              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                onBlur={() => flushIfChanged("linkedinUrl", linkedin || null)}
                placeholder="linkedin.com/in/username"
                className={inputCls}
              />
            </Field>
            <Field label="Website">
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onBlur={() => flushIfChanged("websiteUrl", website || null)}
                placeholder="example.com"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 p-2 text-sm text-claude-cream placeholder:text-claude-cream/40 focus:border-claude-coral focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-claude-cream/60">{label}</span>
      {children}
    </label>
  );
}
