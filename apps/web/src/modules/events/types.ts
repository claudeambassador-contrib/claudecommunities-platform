export type EventStatus = "draft" | "published" | "cancelled";
export type RsvpStatus = "going" | "interested" | "not_going";
export type StoredRsvpStatus = "going" | "interested";
export type AgendaItemType = "speaker" | "welcome" | "break" | "custom";

export interface EventCreateBody {
  city?: string | null;
  description?: string | null;
  endTime?: string | null;
  eventType?: string;
  feedbackUrl?: string | null;
  footerText?: string | null;
  headerText?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  isOnline?: boolean;
  location?: string | null;
  lumaUrl?: string | null;
  maxAttendees?: number | null;
  meetingUrl?: string | null;
  rsvpEnabled?: boolean;
  startTime: string;
  timezone?: string | null;
  title: string;
}

export type EventUpdateBody = Partial<EventCreateBody>;

/** Persistence write DTO — dates stay as Date only inside the repository. */
export interface EventWrite {
  city?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  endsAt?: Date | null;
  eventType?: string;
  feedbackUrl?: string | null;
  footerText?: string | null;
  headerText?: string | null;
  isOnline?: boolean;
  location?: string | null;
  lumaUrl?: string | null;
  maxAttendees?: number | null;
  meetingUrl?: string | null;
  rsvpEnabled?: boolean;
  slug: string;
  startsAt: Date;
  status?: EventStatus;
  timezone?: string | null;
  title: string;
}

export interface RsvpRow {
  createdAt: string;
  status: StoredRsvpStatus;
  userId: string;
}

export interface EventDetail {
  city: string | null;
  createdAt: string;
  description: string | null;
  endTime: string | null;
  eventType: string;
  feedbackUrl: string | null;
  footerText: string | null;
  headerText: string | null;
  id: string;
  imageUrl: string | null;
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
