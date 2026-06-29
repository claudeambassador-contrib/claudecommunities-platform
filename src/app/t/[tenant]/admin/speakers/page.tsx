"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Lock,
  LockOpen,
  MapPin,
  MessageSquare,
  Mic,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Can, useCan } from "@/components/admin/Can";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Submission {
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
  deletedAt: string | null;
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
  pending: "bg-[#F59E0B]/20 text-[#F59E0B]",
  approved: "bg-[#10B981]/20 text-[#10B981]",
  declined: "bg-red-500/20 text-red-400",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

type DeleteMode = "soft" | "hard";
type TabKey = "all" | "pending" | "approved" | "declined" | "deleted";

export default function AdminSpeakersPage() {
  const can = useCan();
  const config = useTenantConfig();
  const canDelete = can("speakers.delete");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    submission: Submission;
    mode: DeleteMode;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchSubmissions runs once on mount; adding it would refetch on every render
  useEffect(() => {
    void fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    try {
      // Only request soft-deleted rows when the viewer can act on them; the
      // "Deleted" tab is gated on the same permission.
      const res = await fetch(`/api/admin/speakers${canDelete ? "?includeDeleted=true" : ""}`);
      if (res.ok) {
        const data = (await res.json()) as { submissions: Submission[] };
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: string, body: Partial<Submission> & { deleted?: boolean }) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/speakers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as { submission?: Submission };
        if (data.submission) {
          setSubmissions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, ...data.submission } : s)),
          );
        }
      }
    } catch (err) {
      console.error("Failed to update submission:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteSubmission(id: string) {
    try {
      const res = await fetch(`/api/admin/speakers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete submission:", err);
    }
  }

  const cities = Array.from(
    new Set(submissions.map((s) => s.city).filter((c): c is string => !!c)),
  ).sort((a, b) => a.localeCompare(b));

  const cityScoped =
    cityFilter === "all" ? submissions : submissions.filter((s) => s.city === cityFilter);

  // Soft-deleted rows live only under the "Deleted" tab; everything else
  // operates on the active set so deleted rows never leak into "All".
  const activeScoped = cityScoped.filter((s) => !s.deletedAt);
  const deletedScoped = cityScoped.filter((s) => s.deletedAt);

  const filtered =
    filter === "deleted"
      ? deletedScoped
      : filter === "all"
        ? activeScoped
        : activeScoped.filter((s) => s.status === filter);

  const counts: Record<TabKey, number> = {
    all: activeScoped.length,
    pending: activeScoped.filter((s) => s.status === "pending").length,
    approved: activeScoped.filter((s) => s.status === "approved").length,
    declined: activeScoped.filter((s) => s.status === "declined").length,
    deleted: deletedScoped.length,
  };

  const tabs: TabKey[] = canDelete
    ? ["all", "pending", "approved", "declined", "deleted"]
    : ["all", "pending", "approved", "declined"];

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#2D2926] text-[#A8A29E] hover:text-white"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-1.5 text-xs opacity-70">({counts[tab]})</span>
            </button>
          ))}
          {cities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="sm:ml-auto px-3 py-2 rounded-lg text-sm font-medium bg-[#2D2926] text-[#A8A29E] border border-white/[0.06] focus:outline-none focus:border-[#D4836A]/50"
            >
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Mic className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
            <p className="text-[#A8A29E]">
              {filter === "all" ? "No submissions yet" : `No ${filter} submissions`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((submission) => {
              const isExpanded = expandedId === submission.id;
              return (
                <div
                  key={submission.id}
                  className="bg-[#2D2926] rounded-xl border border-white/[0.06] overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full text-left p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-white font-medium truncate">{submission.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[submission.status]}`}
                        >
                          {submission.status}
                        </span>
                        {submission.city && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#78716C]/20 text-[#A8A29E]">
                            <MapPin className="w-3 h-3" /> {submission.city}
                          </span>
                        )}
                        {submission.contentLocked && (
                          <span
                            title="Content locked"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#78716C]/20 text-[#A8A29E]"
                          >
                            <Lock className="w-3 h-3" /> content
                          </span>
                        )}
                        {submission.slidesLocked && (
                          <span
                            title="Slides locked"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#78716C]/20 text-[#A8A29E]"
                          >
                            <Lock className="w-3 h-3" /> slides
                          </span>
                        )}
                        {submission.slidesUrl && (
                          <span
                            title="Has slides"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#D4836A]/15 text-[#D4836A]"
                          >
                            <FileText className="w-3 h-3" /> slides
                          </span>
                        )}
                      </div>
                      <p className="text-[#A8A29E] text-sm truncate">{submission.title}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[#78716C] text-sm hidden sm:block">
                        {new Date(submission.createdAt).toLocaleDateString(config.lang, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#78716C]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#78716C]" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <AdminTalkPanel
                      submission={submission}
                      busy={updatingId === submission.id}
                      onPatch={(body) => patch(submission.id, body)}
                      onSoftDelete={() => setConfirmTarget({ submission, mode: "soft" })}
                      onRestore={() => patch(submission.id, { deleted: false })}
                      onPermanentDelete={() => setConfirmTarget({ submission, mode: "hard" })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={!!confirmTarget}
        variant="destructive"
        title={
          confirmTarget?.mode === "hard"
            ? "Delete this submission permanently?"
            : "Move this submission to Deleted?"
        }
        description={
          confirmTarget
            ? confirmTarget.mode === "hard"
              ? `"${confirmTarget.submission.title}" by ${confirmTarget.submission.name} will be removed, along with any comments. This cannot be undone.`
              : `"${confirmTarget.submission.title}" by ${confirmTarget.submission.name} will move to the Deleted tab and stay in the database. You can restore it later.`
            : undefined
        }
        confirmLabel={confirmTarget?.mode === "hard" ? "Delete permanently" : "Move to Deleted"}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (!confirmTarget) return;
          const { submission, mode } = confirmTarget;
          setConfirmTarget(null);
          if (mode === "hard") {
            await deleteSubmission(submission.id);
          } else {
            await patch(submission.id, { deleted: true });
          }
        }}
      />
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive edit/review panel; the branching maps directly to the submission's status and lock states and splitting it would obscure the layout
function AdminTalkPanel({
  submission,
  busy,
  onPatch,
  onSoftDelete,
  onRestore,
  onPermanentDelete,
}: {
  submission: Submission;
  busy: boolean;
  onPatch: (body: Partial<Submission> & { deleted?: boolean }) => Promise<void> | void;
  onSoftDelete: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  const config = useTenantConfig();
  const isDeleted = !!submission.deletedAt;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(submission.title);
  const [description, setDescription] = useState(submission.description ?? "");
  const [bio, setBio] = useState(submission.bio ?? "");
  const [name, setName] = useState(submission.name);
  const [email, setEmail] = useState(submission.email);
  const [city, setCity] = useState(submission.city ?? "");

  // biome-ignore lint/correctness/useExhaustiveDependencies: submission.id is intentionally listed to re-sync local edit state when the panel switches to a different submission
  useEffect(() => {
    setTitle(submission.title);
    setDescription(submission.description ?? "");
    setBio(submission.bio ?? "");
    setName(submission.name);
    setEmail(submission.email);
    setCity(submission.city ?? "");
  }, [
    submission.id,
    submission.title,
    submission.description,
    submission.bio,
    submission.name,
    submission.email,
    submission.city,
  ]);

  async function saveEdits() {
    await onPatch({ title, description, bio, name, email, city });
    setEditing(false);
  }

  return (
    <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-5">
      {/* Top: contact info + status actions */}
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-[#78716C]">Email:</span>{" "}
          <a href={`mailto:${submission.email}`} className="text-[#D4836A] hover:underline">
            {submission.email}
          </a>
        </div>
        {submission.city && (
          <div>
            <span className="text-[#78716C]">City:</span>{" "}
            <span className="text-white">{submission.city}</span>
          </div>
        )}
        <div className="sm:col-span-2 text-xs text-[#78716C]">
          Submitted{" "}
          {new Date(submission.createdAt).toLocaleString(config.lang, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Talk content (read or edit) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-wide text-[#A8A29E] font-semibold">
            Talk content
          </h4>
          <Can permission="speakers.edit">
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-[#D4836A] hover:underline"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs text-[#A8A29E] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={busy}
                  className="text-xs text-[#10B981] hover:underline disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}
          </Can>
        </div>

        {editing ? (
          <div className="space-y-2">
            <label className="block text-xs text-[#A8A29E]">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm"
              />
            </label>
            <label className="block text-xs text-[#A8A29E]">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm"
              />
            </label>
            <label className="block text-xs text-[#A8A29E]">
              Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm"
              />
            </label>
            <label className="block text-xs text-[#A8A29E]">
              Description (markdown)
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm font-mono"
              />
            </label>
            <label className="block text-xs text-[#A8A29E]">
              Bio
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm"
              />
            </label>
            <label className="block text-xs text-[#A8A29E]">
              City
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <span className="text-xs text-[#78716C]">Title:</span>
              <p className="text-white text-sm mt-0.5">{submission.title}</p>
            </div>
            {submission.description && (
              <div>
                <span className="text-xs text-[#78716C]">Description:</span>
                <p className="text-[#A8A29E] text-sm mt-0.5 whitespace-pre-wrap">
                  {submission.description}
                </p>
              </div>
            )}
            {submission.bio && (
              <div>
                <span className="text-xs text-[#78716C]">Bio:</span>
                <p className="text-[#A8A29E] text-sm mt-0.5 whitespace-pre-wrap">
                  {submission.bio}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Slides */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-[#A8A29E] font-semibold">Slides</h4>
        {submission.slidesUrl ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg">
            <FileText className="w-4 h-4 text-[#D4836A]" />
            <a
              href={submission.slidesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white hover:text-[#D4836A] truncate flex-1"
            >
              {submission.slidesFileName ?? "Open slides"}
            </a>
            <span className="text-xs text-[#78716C]">{formatBytes(submission.slidesSize)}</span>
          </div>
        ) : (
          <p className="text-xs text-[#78716C]">No slides uploaded yet.</p>
        )}
      </section>

      {/* Comments */}
      <AdminCommentsThread submissionId={submission.id} />

      {/* Bottom actions: deleted rows get restore / permanent delete;
          active rows get status + locks + soft delete. */}
      <div className="flex items-center gap-2 pt-2 flex-wrap border-t border-white/[0.04]">
        {isDeleted ? (
          <Can permission="speakers.delete">
            <button
              type="button"
              onClick={onRestore}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/20 text-[#10B981] rounded-lg hover:bg-[#10B981]/30 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Restore
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onPermanentDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium"
              title="Permanently remove from the database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete permanently
            </button>
          </Can>
        ) : (
          <>
            <Can permission="speakers.edit">
              {submission.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => onPatch({ status: "approved" })}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/20 text-[#10B981] rounded-lg hover:bg-[#10B981]/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Approve
                </button>
              )}
              {submission.status !== "declined" && (
                <button
                  type="button"
                  onClick={() => onPatch({ status: "declined" })}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  Decline
                </button>
              )}
              {submission.status !== "pending" && (
                <button
                  type="button"
                  onClick={() => onPatch({ status: "pending" })}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded-lg hover:bg-[#F59E0B]/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Reset to pending
                </button>
              )}
              <div className="w-px h-6 bg-white/[0.06] mx-1" />
              <button
                type="button"
                onClick={() => onPatch({ contentLocked: !submission.contentLocked })}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] text-[#A8A29E] hover:text-white rounded-lg text-sm font-medium disabled:opacity-50"
                title="Block user from editing title/description/comments"
              >
                {submission.contentLocked ? (
                  <LockOpen className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                {submission.contentLocked ? "Unlock content" : "Lock content"}
              </button>
              <button
                type="button"
                onClick={() => onPatch({ slidesLocked: !submission.slidesLocked })}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1917] border border-white/[0.06] text-[#A8A29E] hover:text-white rounded-lg text-sm font-medium disabled:opacity-50"
                title="Block user from changing slides"
              >
                {submission.slidesLocked ? (
                  <LockOpen className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                {submission.slidesLocked ? "Unlock slides" : "Lock slides"}
              </button>
            </Can>
            <div className="flex-1" />
            <Can permission="speakers.delete">
              <button
                type="button"
                onClick={onSoftDelete}
                className="p-1.5 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Move to Deleted"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Can>
          </>
        )}
      </div>
    </div>
  );
}

function AdminCommentsThread({ submissionId }: { submissionId: string }) {
  const config = useTenantConfig();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/speakers/${submissionId}/comments`);
      if (res.ok) {
        const data = (await res.json()) as { comments: Comment[] };
        setComments(data.comments);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, [submissionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function post() {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/speakers/${submissionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = (await res.json()) as { comment: Comment };
        setComments((prev) => [...(prev ?? []), data.comment]);
        setDraft("");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="space-y-2">
      <h4 className="text-xs uppercase tracking-wide text-[#A8A29E] font-semibold flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5" />
        Conversation{comments && comments.length > 0 ? ` (${comments.length})` : ""}
      </h4>
      {comments === null ? (
        <div className="text-xs text-[#78716C]">Loading…</div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[#78716C]">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`p-2.5 rounded-lg border text-sm ${
                c.author?.role !== "member"
                  ? "bg-[#D4836A]/10 border-[#D4836A]/20"
                  : "bg-[#1C1917] border-white/[0.06]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 text-xs">
                <span className="text-white font-medium">{c.author?.name ?? "User"}</span>
                {c.author?.role !== "member" && (
                  <span className="px-1.5 py-0.5 rounded bg-[#D4836A]/20 text-[#D4836A] text-[10px] uppercase">
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
              <p className="text-white whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply or ask a question…"
          className="flex-1 px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:border-[#D4836A]/50 resize-none"
        />
        <button
          type="button"
          onClick={() => void post()}
          disabled={posting || !draft.trim()}
          className="self-end inline-flex items-center gap-1.5 px-3 py-2 bg-[#D4836A] hover:bg-[#c4775f] disabled:opacity-50 text-white text-sm rounded-lg"
        >
          {posting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send
        </button>
      </div>
    </section>
  );
}
