/**
 * Client-side helpers for the slide-generator persistence API.
 *
 * State is keyed by an opaque `scope` string (`"global"` or `"event:<id>"`).
 * Presets are reusable visual-style snapshots — admin saves the current
 * template look as a named entry, then applies it to other events.
 */
import type { SlideSpeaker, SlideTemplate } from "./types";

/** One configured slide variant on an event (e.g. "1:1" and "4:3"). */
export interface SlideEntry {
  /** Local id — stable within the scope. */
  id: string;
  /** User-editable display label. Defaults to the template's aspect ratio. */
  label: string;
  template: SlideTemplate;
}

/**
 * v2: multiple slide variants per scope. Speakers are kept here only for
 * the standalone admin tool ("global" scope); per-event scopes get their
 * canonical speaker list from the Speaker table and pass it via props.
 */
export interface StoredStateV2 {
  version: 2;
  slides: SlideEntry[];
  speakers?: SlideSpeaker[];
  seededIds?: string[];
}

/** v1: single template + inline speakers. Read-only — migrated on first load. */
export interface StoredStateV1 {
  template: SlideTemplate;
  speakers: SlideSpeaker[];
  seededIds: string[];
}

export type StoredState = StoredStateV2;

export interface SlidePreset {
  id: string;
  name: string;
  data: SlideTemplate;
  createdAt: string;
  updatedAt: string;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Raw fetch — returns either the v2 shape or the legacy v1 shape so callers
 * can decide how to migrate. Use {@link fetchStateMigrated} for v2-normalised.
 */
export async function fetchState(scope: string): Promise<StoredStateV2 | StoredStateV1 | null> {
  const res = await fetch(`/api/admin/slide-generator/state?scope=${encodeURIComponent(scope)}`, {
    cache: "no-store",
  });
  const body = await asJson<{ data: StoredStateV2 | StoredStateV1 | null }>(res);
  return body.data ?? null;
}

export async function saveState(scope: string, state: StoredState): Promise<void> {
  await asJson(
    await fetch("/api/admin/slide-generator/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, data: state }),
    }),
  );
}

export async function fetchPresets(): Promise<SlidePreset[]> {
  return asJson<SlidePreset[]>(
    await fetch("/api/admin/slide-generator/presets", { cache: "no-store" }),
  );
}

export async function createPreset(name: string, data: SlideTemplate): Promise<SlidePreset> {
  return asJson<SlidePreset>(
    await fetch("/api/admin/slide-generator/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    }),
  );
}

export async function deletePreset(id: string): Promise<void> {
  await asJson(
    await fetch(`/api/admin/slide-generator/presets/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}
