"use client";

import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  Lock,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TenantLink, useTenantBase } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { tenantHref } from "@/lib/tenant-base";
import { uploadFile } from "@/lib/upload-client";

interface Talk {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  title: string;
  description: string | null;
  bio: string | null;
  city: string | null;
  slidesUrl: string | null;
  slidesFileName: string | null;
  slidesMimeType: string | null;
  slidesSize: number | null;
  status: string;
  contentLocked: boolean;
  slidesLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  submissionId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  } | null;
}

const statusStyles: Record<string, string> = {
  pending: "bg-[#F59E0B]/15 text-[#F59E0B]",
  approved: "bg-[#10B981]/15 text-[#10B981]",
  declined: "bg-red-500/15 text-red-400",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function TalkEditor({ talkId }: { talkId: string }) {
  const config = useTenantConfig();
  const toast = useToast();
  const base = useTenantBase();
  const [talk, setTalk] = useState<Talk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Local field state — flushed to the server on blur.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");

  const reload = useCallback(async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        fetch(`/api/talks/${talkId}`),
        fetch(`/api/talks/${talkId}/comments`),
      ]);
      if (!tRes.ok) throw new Error(`HTTP ${tRes.status}`);
      const tData = (await tRes.json()) as { talk: Talk };
      setTalk(tData.talk);
      setTitle(tData.talk.title);
      setDescription(tData.talk.description ?? "");
      setBio(tData.talk.bio ?? "");
      setCity(tData.talk.city ?? "");
      setName(tData.talk.name);
      if (cRes.ok) {
        const cData = (await cRes.json()) as { comments: Comment[] };
        setComments(cData.comments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [talkId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function patchTalk(patch: Partial<Talk>) {
    if (!talk) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/talks/${talkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { talk?: Talk; error?: string };
      if (!res.ok || !data.talk) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTalk(data.talk);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      setSaveState("idle");
      toast.error("Failed to save", err instanceof Error ? err.message : String(err));
    }
  }

  const flushIfChanged = useCallback(
    <K extends keyof Talk>(key: K, value: Talk[K]) => {
      if (!talk) return;
      const current = (talk[key] ?? "") as unknown;
      const next = (value ?? "") as unknown;
      if (current !== next) void patchTalk({ [key]: value } as Partial<Talk>);
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: patchTalk is recreated each render; the talk dep already recaptures it, so listing it here is intentional and must not be removed
    [talk, patchTalk],
  );

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadFile(file, { folder: "talk-slides" });
      const res = await fetch(`/api/talks/${talkId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slidesUrl: url,
          slidesFileName: file.name,
          slidesMimeType: file.type || null,
          slidesSize: file.size,
        }),
      });
      const data = (await res.json()) as { talk?: Talk; error?: string };
      if (!res.ok || !data.talk) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTalk(data.talk);
      toast.success("Slides uploaded");
    } catch (err) {
      toast.error("Upload failed", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function clearSlides() {
    try {
      const res = await fetch(`/api/talks/${talkId}/slides`, { method: "DELETE" });
      const data = (await res.json()) as { talk?: Talk; error?: string };
      if (!res.ok || !data.talk) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTalk(data.talk);
    } catch (err) {
      toast.error("Failed to remove slides", err instanceof Error ? err.message : String(err));
    }
  }

  async function postComment() {
    const text = commentDraft.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/talks/${talkId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = (await res.json()) as { comment?: Comment; error?: string };
      if (!res.ok || !data.comment) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setComments((prev) => [...prev, data.comment as Comment]);
      setCommentDraft("");
    } catch (err) {
      toast.error("Failed to post comment", err instanceof Error ? err.message : String(err));
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/talks/${talkId}/comments/${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      toast.error("Failed to delete", err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteTalk() {
    try {
      const res = await fetch(`/api/talks/${talkId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      window.location.href = tenantHref(base, "/my-talks");
    } catch (err) {
      toast.error("Failed to delete", err instanceof Error ? err.message : String(err));
    }
  }

  if (error) {
    return (
      <div>
        <TenantLink
          href="/my-talks"
          className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to my talks
        </TenantLink>
        <div className="p-4 bg-red-500/10 text-red-400 rounded-xl text-sm">{error}</div>
      </div>
    );
  }

  if (!talk) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#A8A29E] animate-spin" />
      </div>
    );
  }

  const contentDisabled = talk.contentLocked;
  const slidesDisabled = talk.slidesLocked;

  return (
    <div className="space-y-8">
      <div>
        <TenantLink
          href="/my-talks"
          className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to my talks
        </TenantLink>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-white truncate">{talk.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[talk.status] ?? statusStyles.pending}`}
              >
                {talk.status}
              </span>
              {talk.contentLocked && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-[#78716C]/20 text-[#A8A29E]"
                  title="Content is locked by admin"
                >
                  <Lock className="w-3 h-3" /> Content locked
                </span>
              )}
              {talk.slidesLocked && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-[#78716C]/20 text-[#A8A29E]"
                  title="Slides are locked by admin"
                >
                  <Lock className="w-3 h-3" /> Slides locked
                </span>
              )}
              {saveState === "saving" && (
                <span className="inline-flex items-center gap-1 text-xs text-[#78716C]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving
                </span>
              )}
              {saveState === "saved" && (
                <span className="inline-flex items-center gap-1 text-xs text-[#10B981]">
                  <CheckCircle className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Talk content */}
      <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wide text-[#A8A29E]">
          Talk content
        </h2>
        <Field label="Speaker name" disabled={contentDisabled}>
          <input
            type="text"
            value={name}
            disabled={contentDisabled}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => flushIfChanged("name", name)}
            className="w-full px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white disabled:opacity-60 focus:outline-none focus:border-[#D4836A]/50"
          />
        </Field>
        <Field label="Title" disabled={contentDisabled}>
          <input
            type="text"
            value={title}
            disabled={contentDisabled}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => flushIfChanged("title", title)}
            className="w-full px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white disabled:opacity-60 focus:outline-none focus:border-[#D4836A]/50"
          />
        </Field>
        <Field label="Description (markdown)" disabled={contentDisabled}>
          <textarea
            rows={6}
            value={description}
            disabled={contentDisabled}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => flushIfChanged("description", description || null)}
            className="w-full px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white disabled:opacity-60 focus:outline-none focus:border-[#D4836A]/50 resize-y font-mono text-sm"
            placeholder="What will the audience walk away with?"
          />
        </Field>
        <Field label="Speaker bio" disabled={contentDisabled}>
          <textarea
            rows={3}
            value={bio}
            disabled={contentDisabled}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => flushIfChanged("bio", bio || null)}
            className="w-full px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white disabled:opacity-60 focus:outline-none focus:border-[#D4836A]/50 resize-y"
            placeholder="A sentence or two about yourself"
          />
        </Field>
        <Field label="Preferred city" disabled={contentDisabled}>
          <input
            type="text"
            value={city}
            disabled={contentDisabled}
            onChange={(e) => setCity(e.target.value)}
            onBlur={() => flushIfChanged("city", city || null)}
            className="w-full px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white disabled:opacity-60 focus:outline-none focus:border-[#D4836A]/50"
            placeholder="Sydney"
          />
        </Field>
      </section>

      {/* Slides */}
      <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm uppercase tracking-wide text-[#A8A29E]">
            Slides
          </h2>
          {slidesDisabled && (
            <span className="inline-flex items-center gap-1 text-xs text-[#A8A29E]">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
        </div>
        <p className="text-xs text-[#78716C]">
          PDF, PPT, or PPTX. You can upload slides before or after the event.
        </p>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onPickFile(file);
          }}
        />
        {talk.slidesUrl ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl">
            <FileText className="w-5 h-5 text-[#D4836A] shrink-0" />
            <div className="min-w-0 flex-1">
              <a
                href={talk.slidesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-sm truncate hover:text-[#D4836A]"
              >
                {talk.slidesFileName ?? "Slides"}
              </a>
              <div className="text-xs text-[#78716C]">{formatBytes(talk.slidesSize)}</div>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || slidesDisabled}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#A8A29E] hover:text-white border border-white/[0.06] rounded-lg disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => void clearSlides()}
              disabled={slidesDisabled}
              className="p-1.5 text-[#78716C] hover:text-red-400 disabled:opacity-50"
              aria-label="Remove slides"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || slidesDisabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1C1917] border border-dashed border-white/[0.12] hover:border-[#D4836A]/50 rounded-xl text-[#A8A29E] hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Upload slides
              </>
            )}
          </button>
        )}
      </section>

      {/* Comments */}
      <section className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm uppercase tracking-wide text-[#A8A29E]">
          Conversation
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-[#78716C]">
            No comments yet. Send a question to the organisers, or wait for them to reach out.
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li
                key={c.id}
                className={`p-3 rounded-lg border ${
                  c.author?.role !== "member"
                    ? "bg-[#D4836A]/10 border-[#D4836A]/20"
                    : "bg-[#1C1917] border-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white font-medium">{c.author?.name ?? "User"}</span>
                    {c.author?.role !== "member" && (
                      <span className="px-1.5 py-0.5 rounded bg-[#D4836A]/20 text-[#D4836A] text-[10px] uppercase tracking-wide">
                        Admin
                      </span>
                    )}
                    <span className="text-[#78716C]">
                      {new Date(c.createdAt).toLocaleString(config.lang, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {c.authorId === talk.userId && (
                    <button
                      type="button"
                      onClick={() => void deleteComment(c.id)}
                      className="p-1 text-[#78716C] hover:text-red-400"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-white whitespace-pre-wrap">{c.content}</p>
              </li>
            ))}
          </ul>
        )}

        {talk.contentLocked ? (
          <p className="text-xs text-[#78716C] italic">
            This thread is locked. Reach out to an organiser directly to follow up.
          </p>
        ) : (
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a message…"
              className="flex-1 px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#D4836A]/50 resize-none"
            />
            <button
              type="button"
              onClick={() => void postComment()}
              disabled={postingComment || !commentDraft.trim()}
              className="self-end inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4836A] hover:bg-[#c4775f] disabled:opacity-50 text-white text-sm rounded-lg"
            >
              {postingComment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
        )}
      </section>

      {/* Danger zone */}
      {!talk.contentLocked && !talk.slidesLocked && talk.status === "pending" && (
        <section className="bg-[#2D2926] rounded-xl border border-red-500/20 p-5">
          <h2 className="text-red-400 font-semibold text-sm uppercase tracking-wide mb-2">
            Danger zone
          </h2>
          <p className="text-xs text-[#A8A29E] mb-3">
            Delete this submission entirely. You can only delete while it&apos;s still pending.
          </p>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm"
          >
            <Trash2 className="w-4 h-4" /> Delete talk
          </button>
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        variant="destructive"
        title="Delete this talk?"
        description="This is permanent — your submission and any comments will be removed."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteTalk();
        }}
      />
    </div>
  );
}

function Field({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="flex items-center gap-1 text-xs text-[#A8A29E] mb-1">
        {label}
        {disabled && <Lock className="w-3 h-3 text-[#78716C]" />}
      </span>
      {children}
    </div>
  );
}
