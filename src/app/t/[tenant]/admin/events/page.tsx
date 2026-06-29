"use client";

import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Can } from "@/components/admin/Can";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { Avatar } from "@/components/ui/Avatar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { uploadFile } from "@/lib/upload-client";
import EventsCalendar from "./EventsCalendar";
import PrepareEventModal from "./PrepareEventModal";

interface RsvpUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  rsvpDate: string;
}

function RsvpViewerModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [going, setGoing] = useState<RsvpUser[]>([]);
  const [interested, setInterested] = useState<RsvpUser[]>([]);
  const [emailsGoing, setEmailsGoing] = useState<string[]>([]);
  const [emailsAll, setEmailsAll] = useState<string[]>([]);
  const [copiedGoing, setCopiedGoing] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/events/${event.id}/rsvps`)
      .then((res) => res.json())
      .then((data) => {
        setGoing(data.going || []);
        setInterested(data.interested || []);
        setEmailsGoing(data.emailsGoing || []);
        setEmailsAll(data.emailsAll || []);
      })
      .catch((err) => console.error("Failed to fetch RSVPs:", err))
      .finally(() => setLoading(false));
  }, [event.id]);

  const copyEmails = async (emails: string[], type: "going" | "all") => {
    await navigator.clipboard.writeText(emails.join(", "));
    if (type === "going") {
      setCopiedGoing(true);
      setTimeout(() => setCopiedGoing(false), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2a2a2a] rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#333] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">RSVPs</h2>
            <p className="text-sm text-gray-400 truncate">{event.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#E07A5F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : going.length === 0 && interested.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No RSVPs yet</p>
          ) : (
            <div className="space-y-5">
              {going.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-green-400 mb-2">
                    Going ({going.length})
                  </h3>
                  <div className="space-y-2">
                    {going.map((user) => (
                      <div key={user.id} className="flex items-center gap-3 text-sm">
                        <Avatar
                          src={user.image}
                          name={user.name}
                          alt=""
                          className="w-7 h-7 rounded-full bg-[#333] flex-shrink-0 overflow-hidden"
                          fallbackClassName="text-xs text-gray-400"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-white">{user.name || "Unknown"}</span>
                          {user.email && <span className="text-gray-500 ml-2">{user.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {interested.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-amber-400 mb-2">
                    Interested ({interested.length})
                  </h3>
                  <div className="space-y-2">
                    {interested.map((user) => (
                      <div key={user.id} className="flex items-center gap-3 text-sm">
                        <Avatar
                          src={user.image}
                          name={user.name}
                          alt=""
                          className="w-7 h-7 rounded-full bg-[#333] flex-shrink-0 overflow-hidden"
                          fallbackClassName="text-xs text-gray-400"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-white">{user.name || "Unknown"}</span>
                          {user.email && <span className="text-gray-500 ml-2">{user.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!loading && (emailsGoing.length > 0 || emailsAll.length > 0) && (
          <div className="p-4 border-t border-[#333] flex gap-2">
            {emailsGoing.length > 0 && (
              <button
                type="button"
                onClick={() => copyEmails(emailsGoing, "going")}
                className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors text-sm font-medium flex-1 justify-center"
              >
                {copiedGoing ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedGoing ? "Copied!" : `Copy Going Emails (${emailsGoing.length})`}
              </button>
            )}
            {emailsAll.length > 0 && (
              <button
                type="button"
                onClick={() => copyEmails(emailsAll, "all")}
                className="flex items-center gap-2 px-3 py-2 bg-[#E07A5F]/20 text-[#E07A5F] rounded-lg hover:bg-[#E07A5F]/30 transition-colors text-sm font-medium flex-1 justify-center"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAll ? "Copied!" : `Copy All Emails (${emailsAll.length})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface EventResource {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ResourceManagerModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const [resources, setResources] = useState<EventResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/resources`);
      if (res.ok) setResources(await res.json());
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the event changes; load is a stable closure intentionally omitted to avoid a refetch loop
  useEffect(() => {
    load();
  }, [event.id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile || !title.trim()) {
      setError("Title and file are required");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      setProgress("Uploading… 0%");
      const { url: fileUrl } = await uploadFile(pendingFile, {
        folder: "event-resources",
        onProgress: (pct) => setProgress(`Uploading… ${pct}%`),
      });

      setProgress("Saving…");
      const saveRes = await fetch(`/api/admin/events/${event.id}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          fileUrl,
          fileName: pendingFile.name,
          mimeType: pendingFile.type || "application/octet-stream",
          fileSize: pendingFile.size,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save resource");

      setTitle("");
      setDescription("");
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource?")) return;
    const res = await fetch(`/api/admin/events/${event.id}/resources/${id}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  };

  const handleRename = async (id: string, currentTitle: string) => {
    const newTitle = prompt("Resource title", currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;
    const res = await fetch(`/api/admin/events/${event.id}/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) load();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2a2a2a] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#333] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Resources</h2>
            <p className="text-sm text-gray-400 truncate">{event.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <form
            onSubmit={handleUpload}
            className="space-y-3 p-4 bg-[#1a1a1a] border border-[#333] rounded-lg"
          >
            <h3 className="text-sm font-medium text-white">Add a resource</h3>
            <div>
              <label htmlFor="resource-title" className="block text-xs text-gray-400 mb-1">
                Title *
              </label>
              <input
                id="resource-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sarah's lightning talk slides"
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#E07A5F]"
              />
            </div>
            <div>
              <label htmlFor="resource-description" className="block text-xs text-gray-400 mb-1">
                Description
              </label>
              <textarea
                id="resource-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#E07A5F] resize-none"
              />
            </div>
            <div>
              <label htmlFor="resource-file" className="block text-xs text-gray-400 mb-1">
                File *
              </label>
              <input
                id="resource-file"
                ref={fileRef}
                type="file"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.zip"
                className="w-full text-sm text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-[#E07A5F] file:text-white file:cursor-pointer hover:file:bg-[#c96a52]"
              />
              {pendingFile && (
                <p className="text-xs text-gray-500 mt-1">
                  {pendingFile.name} · {formatBytes(pendingFile.size)}
                </p>
              )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={uploading || !pendingFile || !title.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#E07A5F] text-white text-sm rounded-lg hover:bg-[#c96a52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? progress || "Uploading…" : "Upload"}
            </button>
          </form>

          <div>
            <h3 className="text-sm font-medium text-white mb-2">
              {resources.length} resource{resources.length === 1 ? "" : "s"}
            </h3>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#E07A5F]" />
              </div>
            ) : resources.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No resources uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {resources.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#333] rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-[#E07A5F] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white hover:underline block truncate"
                      >
                        {r.title}
                      </a>
                      <p className="text-xs text-gray-500 truncate">
                        {r.fileName} · {formatBytes(r.fileSize)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRename(r.id, r.title)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#333] rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Event {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  timezone: string | null;
  eventType: string;
  startTime: string;
  endTime: string | null;
  maxAttendees: number | null;
  isOnline: boolean;
  meetingUrl: string | null;
  imageUrl: string | null;
  lumaUrl: string | null;
  lumaEventId: string | null;
  rsvpEnabled: boolean;
  isActive: boolean;
  headerText?: string | null;
  footerText?: string | null;
  feedbackUrl?: string | null;
  claudienceSessionCode?: string | null;
  claudienceSessionPassword?: string | null;
  claudienceSessionUrl?: string | null;
  claudienceSurveyId?: string | null;
  claudienceSurveyUrl?: string | null;
  _count?: { rsvps: number };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; reducing it requires decomposing the page/card JSX into sub-components with prop threading, out of scope for a lint pass
export default function AdminEventsPage() {
  const config = useTenantConfig();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [lumaSyncing, setLumaSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [rsvpViewEvent, setRsvpViewEvent] = useState<Event | null>(null);
  const [resourceEvent, setResourceEvent] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  // null = closed, "new" = create flow, Event = editing that event.
  const [editor, setEditor] = useState<Event | "new" | null>(null);

  const toggleActive = async (event: Event, next: boolean) => {
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isActive: next } : e)));
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Failed to toggle active:", err);
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, isActive: !next } : e)));
      alert("Failed to update active status");
    }
  };
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const searchParams = useSearchParams();

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; fetchEvents is an unmemoized closure intentionally omitted to avoid a refetch loop
  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setEditor("new");
    }
    const editId = searchParams.get("edit");
    if (editId && events.length > 0) {
      const target = events.find((e) => e.id === editId);
      if (target) setEditor(target);
    }
  }, [searchParams, events]);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events?all=1");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchEvents();
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleLumaSync = async () => {
    setLumaSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/admin/events/luma-sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage({
          type: "success",
          text: `Synced ${data.synced} events (${data.created} created, ${data.updated} updated)`,
        });
        fetchEvents();
      } else {
        setSyncMessage({ type: "error", text: data.error || "Sync failed" });
      }
    } catch {
      setSyncMessage({ type: "error", text: "Sync failed. Check your connection." });
    } finally {
      setLumaSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const formatDate = (dateString: string, tz?: string | null) => {
    const timeZone = tz || config.defaultTimezone;
    return new Date(dateString).toLocaleDateString(config.lang, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
  };

  const isEventPast = (startTime: string, endTime: string | null): boolean => {
    const now = new Date();
    // An event stays "upcoming" until its end time; fall back to start time
    // when no end time is set.
    const eventEnd = new Date(endTime ?? startTime);
    return eventEnd < now;
  };

  const filteredEvents = events
    .filter((event) =>
      filter === "upcoming"
        ? !isEventPast(event.startTime, event.endTime)
        : isEventPast(event.startTime, event.endTime),
    )
    .sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      // Upcoming: soonest first; past: most recent first.
      return filter === "upcoming" ? aTime - bTime : bTime - aTime;
    });

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Actions */}
      <div className="max-w-6xl mx-auto px-6 pt-8 flex items-center gap-3">
        <div className="bg-[#2D2926] rounded-lg p-1 flex">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "list" ? "bg-[#D4836A] text-white" : "text-[#57534E] hover:text-white"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "calendar"
                ? "bg-[#D4836A] text-white"
                : "text-[#57534E] hover:text-white"
            }`}
          >
            Calendar
          </button>
        </div>
        {viewMode === "list" && (
          <div className="bg-[#2D2926] rounded-lg p-1 flex">
            <button
              type="button"
              onClick={() => setFilter("upcoming")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === "upcoming"
                  ? "bg-[#D4836A] text-white"
                  : "text-[#57534E] hover:text-white"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setFilter("past")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === "past" ? "bg-[#D4836A] text-white" : "text-[#57534E] hover:text-white"
              }`}
            >
              Past
            </button>
          </div>
        )}
        <div className="flex-1" />
        <Can permission="events.edit">
          <button
            type="button"
            onClick={handleLumaSync}
            disabled={lumaSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${lumaSyncing ? "animate-spin" : ""}`} />
            {lumaSyncing ? "Syncing..." : "Sync from Luma"}
          </button>
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="flex items-center gap-2 px-4 py-2 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c96a52] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </Can>
      </div>

      {/* Sync toast */}
      {syncMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
            syncMessage.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {syncMessage.text}
        </div>
      )}

      {rsvpViewEvent && (
        <RsvpViewerModal event={rsvpViewEvent} onClose={() => setRsvpViewEvent(null)} />
      )}

      {resourceEvent && (
        <ResourceManagerModal event={resourceEvent} onClose={() => setResourceEvent(null)} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        variant="destructive"
        title="Delete event?"
        description={
          deleteTarget ? `"${deleteTarget.title}" will be permanently deleted.` : undefined
        }
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await handleDelete(id);
        }}
      />

      {editor !== null && (
        <PrepareEventModal
          event={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onEventUpdate={(patch) => {
            setEditor((cur) => (cur && cur !== "new" ? ({ ...cur, ...patch } as Event) : cur));
            const targetId = editor !== "new" ? editor.id : null;
            if (targetId) {
              setEvents((prev) => prev.map((e) => (e.id === targetId ? { ...e, ...patch } : e)));
            }
          }}
          onEventCreated={(created) => {
            // After create, swap into edit mode so the user can keep going
            // straight into Agenda/Speakers/Slides without closing the modal.
            const ev = created as unknown as Event;
            setEvents((prev) => [...prev, ev]);
            setEditor(ev);
          }}
        />
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Events List / Calendar */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#E07A5F] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : viewMode === "calendar" ? (
          <EventsCalendar
            events={events}
            onSelectEvent={(eventId) => {
              const ev = events.find((e) => e.id === eventId);
              if (ev) setEditor(ev);
            }}
          />
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              {events.length === 0
                ? "No events yet"
                : filter === "upcoming"
                  ? "No upcoming events"
                  : "No past events"}
            </p>
            {events.length === 0 && (
              <p className="text-gray-500 text-sm">Create your first event to get started</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map(
              // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the card's nested badge/actions/toggle JSX would carry the same score if extracted, so reducing it requires a real component decomposition out of scope for a lint pass
              (event) => (
                <div
                  key={event.id}
                  className={`bg-[#2a2a2a] rounded-xl p-5 border border-[#333] flex items-center gap-6 transition-opacity ${
                    event.isActive ? "" : "opacity-60"
                  }`}
                >
                  <div className="w-16 h-16 bg-[#E07A5F]/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[#E07A5F] font-bold text-lg leading-none">
                      {new Date(event.startTime).getDate()}
                    </span>
                    <span className="text-[#E07A5F]/70 text-xs uppercase">
                      {new Date(event.startTime).toLocaleDateString(config.lang, {
                        month: "short",
                      })}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">{event.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(event.startTime, event.timezone)}
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(event.startTime, event.timezone)}
                      </span>
                      {event.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.city}
                        </span>
                      )}
                      {event.maxAttendees && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {event._count?.rsvps || 0} / {event.maxAttendees}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Can permission="events.edit">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={event.isActive}
                        onClick={() => toggleActive(event, !event.isActive)}
                        title={
                          event.isActive ? "Active — visible on /events" : "Inactive — admin-only"
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                          event.isActive ? "bg-emerald-500" : "bg-[#57534E]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                            event.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </Can>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        event.eventType === "workshop"
                          ? "bg-purple-500/20 text-purple-400"
                          : event.eventType === "hackathon"
                            ? "bg-green-500/20 text-green-400"
                            : event.eventType === "social"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-[#E07A5F]/20 text-[#E07A5F]"
                      }`}
                    >
                      {event.eventType}
                    </span>
                    {!event.lumaUrl && (event._count?.rsvps || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setRsvpViewEvent(event)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[#E07A5F] hover:bg-[#E07A5F]/10 rounded-lg transition-colors text-sm"
                        title="View RSVPs"
                      >
                        <Users className="w-4 h-4" />
                        <span>{event._count?.rsvps}</span>
                      </button>
                    )}
                    <a
                      href={`/events/${event.slug || event.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#E07A5F] hover:text-[#c96a52] hover:bg-[#E07A5F]/10 rounded-lg transition-colors"
                      title="View public page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {event.lumaUrl && (
                      <a
                        href={event.lumaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                        title="View on Luma"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <Can permission="events.edit">
                      <button
                        type="button"
                        onClick={() => setResourceEvent(event)}
                        className="p-2 text-gray-400 hover:text-[#E07A5F] hover:bg-[#333] rounded-lg transition-colors"
                        title="Manage resources"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditor(event)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
                        title="Edit event (details, agenda, speakers, slides)"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Can>
                    <Can permission="events.delete">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(event)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#333] rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Can>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
