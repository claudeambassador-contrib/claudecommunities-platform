import type { z } from "zod";
import type { eventWriteInput } from "@/modules/events/schemas";

export type EventStatus = "draft" | "published" | "cancelled";
export type RsvpStatus = "going" | "interested" | "not_going";
export type StoredRsvpStatus = "going" | "interested";
export type AgendaItemType = "speaker" | "welcome" | "break" | "custom";

/**
 * The single event write shape, owned by the module's zod schema. Update
 * bodies use it as-is (every field optional); create bodies additionally
 * require `startTime` and `title`.
 */
export type EventWriteInput = z.infer<typeof eventWriteInput>;

export type EventCreateInput = EventWriteInput & { startTime: string; title: string };

/**
 * Persistence write DTO — the same write shape after the repo-level
 * normalizations: dates parsed to `Date`, `isActive` mapped to `status`, and
 * the slug generated.
 */
export type EventWrite = Omit<EventWriteInput, "endTime" | "isActive" | "startTime" | "title"> & {
  endsAt?: Date | null;
  slug: string;
  startsAt: Date;
  status?: EventStatus;
  title: string;
};

export interface RsvpRow {
  createdAt: string;
  status: StoredRsvpStatus;
  userId: string;
}

export interface EventDetail {
  city: string | null;
  coverUrl: string | null;
  createdAt: string;
  description: string | null;
  endTime: string | null;
  eventType: string;
  feedbackUrl: string | null;
  footerText: string | null;
  headerText: string | null;
  id: string;
  isOnline: boolean;
  location: string | null;
  lumaUrl: string | null;
  maxAttendees: number | null;
  meetingUrl: string | null;
  rsvpCount: number;
  rsvpEnabled: boolean;
  slug: string;
  startTime: string | null;
  status: EventStatus;
  timezone: string | null;
  title: string;
  updatedAt: string;
}

export type EventListItem = EventDetail;

/**
 * What an unauthenticated visitor may see. `meetingUrl` is the private join
 * link — it is the one `EventDetail` field that must never reach a public
 * payload, so public loaders ship this type instead of the full detail.
 */
export type PublicEventDetail = Omit<EventDetail, "meetingUrl">;

export interface AgendaItemInput {
  description?: string | null;
  endTime?: string | null;
  speakerId?: string | null;
  startTime?: string | null;
  title?: string | null;
  type?: AgendaItemType;
}

export interface AgendaItemDetail {
  createdAt: string;
  description: string | null;
  endTime: string | null;
  eventId: string;
  id: string;
  order: number;
  speakerId: string | null;
  startTime: string | null;
  submissionId: string | null;
  title: string | null;
  type: AgendaItemType;
  updatedAt: string;
}

export interface ReorderEntry {
  endTime?: string | null;
  id: string;
  startTime?: string | null;
}

export interface RsvpCounts {
  going: number;
  interested: number;
}

export interface RsvpStats {
  counts: RsvpCounts & { total: number };
  going: { id: string }[];
  interested: { id: string }[];
  isAuthenticated: boolean;
  userRsvp: StoredRsvpStatus | null;
}

export interface EventResourceDetail {
  createdAt: string;
  description: string | null;
  eventId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  id: string;
  mimeType: string;
  title: string;
}

export interface EventResourceInput {
  description?: string | null;
  fileName?: string;
  fileUrl: string;
  mimeType?: string;
  title: string;
}

export interface Clock {
  now: () => Date;
}

export interface LumaWaitlistNotifier {
  notify: (input: {
    userId: string;
    eventId: string;
    lumaUrl: string;
    title: string;
  }) => Promise<void>;
}
