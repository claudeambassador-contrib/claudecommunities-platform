"use client";

import { Link2, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCities } from "@/components/CitiesProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { type City, timezoneForCity } from "@/lib/cities";
import { uploadFile } from "@/lib/upload-client";
import CitySelect from "./CitySelect";
import { localToUTC, TIMEZONE_OPTIONS, utcToLocal } from "./eventFormHelpers";

export interface EventDetails {
  id?: string;
  title: string;
  city: string | null;
  location: string | null;
  timezone: string | null;
  eventType: string;
  startTime: string;
  maxAttendees: number | null;
  isOnline: boolean;
  meetingUrl: string | null;
  lumaUrl: string | null;
  imageUrl: string | null;
  rsvpEnabled: boolean;
  isActive?: boolean;
}

interface FormState {
  title: string;
  city: string;
  location: string;
  timezone: string;
  eventType: string;
  startTime: string;
  maxAttendees: string;
  isOnline: boolean;
  meetingUrl: string;
  lumaUrl: string;
  imageUrl: string;
  rsvpEnabled: boolean;
  isActive: boolean;
}

interface EventDetailsTabProps {
  /** When null, the tab is in "create" mode — onSave POSTs a new event. */
  initial: EventDetails | null;
  isActive?: boolean;
  onToggleActive?: (next: boolean) => void;
  /** Called with the saved/created event after a successful save. */
  onSaved: (saved: EventDetails) => void;
  /** Read-only description rendered from the agenda — display only. */
  generatedDescription: string;
}

function toFormState(
  initial: EventDetails | null,
  defaultTimezone: string,
  cities: City[],
): FormState {
  if (!initial) {
    return {
      title: "",
      city: "",
      location: "",
      timezone: defaultTimezone,
      eventType: "meetup",
      startTime: "",
      maxAttendees: "",
      isOnline: false,
      meetingUrl: "",
      lumaUrl: "",
      imageUrl: "",
      rsvpEnabled: false,
      isActive: true,
    };
  }
  const tz = initial.timezone || timezoneForCity(cities, initial.city || "", defaultTimezone);
  return {
    title: initial.title,
    city: initial.city || "",
    location: initial.location || "",
    timezone: tz,
    eventType: initial.eventType,
    startTime: utcToLocal(initial.startTime, tz),
    maxAttendees: initial.maxAttendees?.toString() || "",
    isOnline: initial.isOnline,
    meetingUrl: initial.meetingUrl || "",
    lumaUrl: initial.lumaUrl || "",
    imageUrl: initial.imageUrl || "",
    rsvpEnabled: initial.rsvpEnabled,
    isActive: initial.isActive ?? true,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complexity is JSX-inherent (conditional sections, inline handlers, nested className ternaries); extracting fragments would obscure the form structure without reducing real branching.
export default function EventDetailsTab({
  initial,
  isActive,
  onToggleActive,
  onSaved,
  generatedDescription,
}: EventDetailsTabProps) {
  const toast = useToast();
  const { defaultTimezone } = useTenantConfig();
  const cities = useCities();
  const isCreate = !initial;
  const [form, setForm] = useState<FormState>(() => toFormState(initial, defaultTimezone, cities));
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-seed local form only when the event identity changes. The parent
  // passes a fresh `initial` object on every render, so depending on the
  // reference itself would wipe in-progress edits on unrelated re-renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    setForm(toFormState(initial, defaultTimezone, cities));
    setImagePreview(initial?.imageUrl ?? null);
  }, [initial?.id]);

  const canSave = useMemo(() => {
    return Boolean(
      form.title.trim() && form.startTime && form.timezone && (form.isOnline || form.city),
    );
  }, [form.title, form.startTime, form.timezone, form.isOnline, form.city]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear payload assembly with per-field null/online conditionals plus error handling; splitting would scatter the request shape without reducing real branching.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const nullIfEmpty = (v: string) => (v === "" ? null : v);
    const tz = form.timezone || defaultTimezone;
    // Don't include `description` — it's autosaved from the Agenda tab and
    // sending null here would wipe it (updateEvent treats `null` as "clear").
    const payload = {
      title: form.title.trim(),
      city: form.isOnline ? "Online" : nullIfEmpty(form.city),
      location: form.isOnline ? null : nullIfEmpty(form.location),
      timezone: tz,
      eventType: form.eventType,
      startTime: localToUTC(form.startTime, tz),
      maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees, 10) : null,
      isOnline: form.isOnline,
      meetingUrl: form.isOnline ? nullIfEmpty(form.meetingUrl) : null,
      lumaUrl: nullIfEmpty(form.lumaUrl),
      imageUrl: nullIfEmpty(form.imageUrl),
      rsvpEnabled: form.rsvpEnabled,
      ...(isCreate ? { isActive: form.isActive } : {}),
    };
    try {
      const url = isCreate ? "/api/events" : `/api/events/${initial?.id}`;
      const method = isCreate ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.details
          ? JSON.stringify(body.details)
          : body?.error || `HTTP ${res.status}`;
        throw new Error(detail);
      }
      // The API returns a thin stub ({id, slug, title, success}) — build the
      // canonical event shape from the payload we just submitted so the
      // parent doesn't see undefined for city/timezone/eventType/etc.
      const stub = (await res.json()) as { id?: string };
      const savedEvent: EventDetails = {
        id: stub.id ?? initial?.id,
        title: payload.title,
        city: payload.city,
        location: payload.location,
        timezone: payload.timezone,
        eventType: payload.eventType,
        startTime: payload.startTime,
        maxAttendees: payload.maxAttendees,
        isOnline: payload.isOnline,
        meetingUrl: payload.meetingUrl,
        lumaUrl: payload.lumaUrl,
        imageUrl: payload.imageUrl,
        rsvpEnabled: payload.rsvpEnabled,
        isActive: isCreate ? form.isActive : (initial?.isActive ?? true),
      };
      onSaved(savedEvent);
      if (!isCreate) toast.success("Event details saved");
    } catch (err) {
      console.error("Failed to save event:", err);
      toast.error("Failed to save event", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-w-3xl mx-auto">
        <div>
          <label htmlFor="event-title" className="block text-sm text-gray-400 mb-1">
            Title *
          </label>
          <input
            id="event-title"
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
            placeholder="Sydney Claude Meetup"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="block text-sm text-gray-400">Description</span>
            <span className="text-[11px] text-gray-500">
              Auto-generated from the Agenda tab — read-only
            </span>
          </div>
          <div className="px-4 py-3 bg-[#1a1a1a] border border-dashed border-[#333] rounded-lg max-h-48 overflow-y-auto">
            {generatedDescription ? (
              <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono">
                {generatedDescription}
              </pre>
            ) : (
              <p className="text-gray-500 text-sm italic">
                Add agenda items, intro and footer in the Agenda tab.
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="event-image" className="block text-sm text-gray-400 mb-1">
            Event Image
          </label>
          {imagePreview ? (
            <div className="relative w-full h-48 rounded-lg overflow-hidden border border-[#333] bg-[#111] group">
              <button
                type="button"
                onClick={() => !imageUploading && fileInputRef.current?.click()}
                disabled={imageUploading}
                className="absolute inset-0 w-full h-full cursor-pointer disabled:cursor-wait"
                aria-label="Replace image"
              >
                <Image
                  src={imagePreview}
                  alt="Event image preview"
                  fill
                  className="object-contain pointer-events-none"
                />
                {!imageUploading && (
                  <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm text-white pointer-events-none">
                    Click to replace
                  </span>
                )}
              </button>
              {imageUploading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <div className="w-8 h-8 border-2 border-[#E07A5F] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-white/80">Uploading…</span>
                </div>
              )}
              {!imageUploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                    setForm((p) => ({ ...p, imageUrl: "" }));
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="w-full h-32 border-2 border-dashed border-[#333] rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#E07A5F] hover:text-[#E07A5F] transition-colors disabled:opacity-50"
            >
              {imageUploading ? (
                <div className="w-6 h-6 border-2 border-[#E07A5F] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
              <span className="text-sm">
                {imageUploading ? "Uploading…" : "Click to upload image"}
              </span>
            </button>
          )}
          <input
            id="event-image"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) {
                toast.error("Image must be under 10MB");
                return;
              }
              setImagePreview(URL.createObjectURL(file));
              setImageUploading(true);
              try {
                const result = await uploadFile(file, { folder: "events" });
                setForm((p) => ({ ...p, imageUrl: result.url }));
                setImagePreview(result.url);
              } catch {
                setImagePreview(form.imageUrl || null);
                toast.error("Upload failed", "Please try again.");
              } finally {
                setImageUploading(false);
              }
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isOnline}
              onChange={(e) => {
                const isOnline = e.target.checked;
                setForm((prev) => ({
                  ...prev,
                  isOnline,
                  city: isOnline ? "Online" : prev.city === "Online" ? "" : prev.city,
                  location: isOnline ? "" : prev.location,
                }));
              }}
              className="w-4 h-4 rounded border-[#333] bg-[#1a1a1a] text-[#E07A5F] focus:ring-[#E07A5F]"
            />
            <span className="text-gray-400">Online event</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: control is the CitySelect component (renders a native select) defined in CitySelect.tsx, which is outside this batch and exposes no id prop to associate */}
            <label className="block text-sm text-gray-400 mb-1">City *</label>
            <CitySelect
              value={form.city}
              onChange={(value) =>
                setForm((p) => ({
                  ...p,
                  city: value,
                  timezone: timezoneForCity(cities, value, defaultTimezone),
                }))
              }
              disabled={form.isOnline}
              required
            />
          </div>
          <div>
            <label htmlFor="event-location" className="block text-sm text-gray-400 mb-1">
              Location
            </label>
            <input
              id="event-location"
              type="text"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              disabled={form.isOnline}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F] disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Venue name, address"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="event-start-time" className="block text-sm text-gray-400 mb-1">
              Date &amp; Time *
            </label>
            <input
              id="event-start-time"
              type="datetime-local"
              required
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
            />
          </div>
          <div>
            <label htmlFor="event-timezone" className="block text-sm text-gray-400 mb-1">
              Timezone *
            </label>
            <select
              id="event-timezone"
              value={form.timezone}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="event-max-attendees" className="block text-sm text-gray-400 mb-1">
              Max Attendees
            </label>
            <input
              id="event-max-attendees"
              type="number"
              min="1"
              value={form.maxAttendees}
              onChange={(e) => setForm((p) => ({ ...p, maxAttendees: e.target.value }))}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
              placeholder="50"
            />
          </div>
          <div>
            <label htmlFor="event-type" className="block text-sm text-gray-400 mb-1">
              Event Type
            </label>
            <select
              id="event-type"
              value={form.eventType}
              onChange={(e) => setForm((p) => ({ ...p, eventType: e.target.value }))}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
            >
              <option value="meetup">Meetup</option>
              <option value="workshop">Workshop</option>
              <option value="hackathon">Hackathon</option>
              <option value="social">Social</option>
            </select>
          </div>
        </div>

        {form.isOnline && (
          <div>
            <label htmlFor="event-meeting-url" className="block text-sm text-gray-400 mb-1">
              Meeting URL
            </label>
            <input
              id="event-meeting-url"
              type="url"
              value={form.meetingUrl}
              onChange={(e) => setForm((p) => ({ ...p, meetingUrl: e.target.value }))}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
              placeholder="https://zoom.us/j/…"
            />
          </div>
        )}

        <div className="border-t border-[#333] pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-[#E07A5F]" />
            <span className="text-sm font-medium text-white">External Event Link (Optional)</span>
          </div>
          <div>
            <label htmlFor="event-luma-url" className="block text-sm text-gray-400 mb-1">
              External ticket URL
            </label>
            <input
              id="event-luma-url"
              type="url"
              value={form.lumaUrl}
              onChange={(e) => setForm((p) => ({ ...p, lumaUrl: e.target.value }))}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F]"
              placeholder="https://lu.ma/your-event or https://eventbrite.com/…"
            />
            <p className="text-xs text-gray-500 mt-1">
              Link to an external ticketing / RSVP page (Luma, Eventbrite, etc.). When you save this
              for the first time, anyone who clicked &ldquo;Notify me when Luma is ready&rdquo; gets
              an in-app notification and an email containing the link.
            </p>
          </div>

          {!form.lumaUrl && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333]">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-200 font-medium">Default behaviour:</span> while this
                  field is empty, the public event page shows a &ldquo;Notify me when Luma is
                  ready&rdquo; button. Signed-in users who opt in get an in-app notification and an
                  email with the Luma link the moment you save one here.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.rsvpEnabled}
                  onChange={(e) => setForm((p) => ({ ...p, rsvpEnabled: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-[#333] bg-[#1a1a1a] text-[#E07A5F] focus:ring-[#E07A5F]"
                />
                <span className="text-sm text-gray-300">
                  Run RSVPs on this site instead
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Replaces the &ldquo;Notify me when Luma is ready&rdquo; button with a Going /
                    Interested RSVP picker. Use this when there is no Luma link at all.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {(isCreate || onToggleActive !== undefined) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Active</span>
              {isCreate ? (
                <button
                  type="button"
                  role="switch"
                  aria-label="Active"
                  aria-checked={form.isActive}
                  onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                    form.isActive ? "bg-emerald-500" : "bg-[#57534E]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                      form.isActive ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-label="Active"
                  aria-checked={isActive ?? false}
                  onClick={() => onToggleActive?.(!(isActive ?? false))}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                    isActive ? "bg-emerald-500" : "bg-[#57534E]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                      isActive ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={!canSave || imageUploading || saving}
            className="px-6 py-2 bg-[#E07A5F] text-white rounded-lg hover:bg-[#c96a52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {(saving || imageUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
            {imageUploading
              ? "Uploading…"
              : saving
                ? "Saving…"
                : isCreate
                  ? "Create event"
                  : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
