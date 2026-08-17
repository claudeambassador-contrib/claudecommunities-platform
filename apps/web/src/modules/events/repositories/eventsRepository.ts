import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { EventAgendaRow, EventRow } from "@/modules/events/schema.tenant";
import type {
  AgendaItemDetail,
  AgendaItemType,
  EventDetail,
  EventStatus,
  StoredRsvpStatus,
} from "@/modules/events/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

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

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function eventUpdateSet(patch: Partial<EventWrite>) {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      set[key] = value;
    }
  }
  return set;
}

function toDetail(row: EventRow, rsvpCount = 0): EventDetail {
  return {
    city: row.city ?? null,
    createdAt: row.createdAt.toISOString(),
    description: row.description ?? null,
    endTime: iso(row.endsAt),
    eventType: row.eventType,
    feedbackUrl: row.feedbackUrl ?? null,
    footerText: row.footerText ?? null,
    headerText: row.headerText ?? null,
    id: row.id,
    imageUrl: row.coverUrl ?? null,
    isOnline: Boolean(row.isOnline),
    location: row.location ?? null,
    lumaUrl: row.lumaUrl ?? null,
    maxAttendees: row.maxAttendees ?? null,
    meetingUrl: row.meetingUrl ?? null,
    rsvpCount,
    rsvpEnabled: Boolean(row.rsvpEnabled),
    slug: row.slug,
    startTime: iso(row.startsAt),
    status: row.status,
    timezone: row.timezone ?? null,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAgenda(row: EventAgendaRow): AgendaItemDetail {
  return {
    createdAt: row.createdAt.toISOString(),
    description: row.description ?? null,
    endTime: iso(row.endsAt),
    eventId: row.eventId,
    id: row.id,
    order: row.sortOrder,
    speakerId: row.speakerId ?? null,
    startTime: iso(row.startsAt),
    submissionId: row.submissionId ?? null,
    title: row.title ?? null,
    type: row.type,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function rsvpCountFor(store: TenantStore, eventId: string): Promise<number> {
  const { eventRsvps } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.orgId, store.orgId), eq(eventRsvps.eventId, eventId)));
  const [countRow] = rows;
  return Number(countRow?.n ?? 0);
}

export async function listEvents(
  store: TenantStore,
  options: { includeInactive?: boolean } = {},
): Promise<EventDetail[]> {
  const { events } = store.tables;
  const rows = await store.db
    .select()
    .from(events)
    .where(
      options.includeInactive
        ? eq(events.orgId, store.orgId)
        : and(eq(events.orgId, store.orgId), eq(events.status, "published")),
    )
    .orderBy(asc(events.startsAt));
  return Promise.all(rows.map(async (row) => toDetail(row, await rsvpCountFor(store, row.id))));
}

export async function getById(
  store: TenantStore,
  id: string,
): Promise<Result<{ event: EventDetail }>> {
  const { events } = store.tables;
  const rows = await store.db
    .select()
    .from(events)
    .where(and(eq(events.orgId, store.orgId), eq(events.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Event not found");
  }
  return ok({ event: toDetail(row, await rsvpCountFor(store, row.id)) });
}

export async function findBySlug(store: TenantStore, slug: string): Promise<EventDetail | null> {
  const { events } = store.tables;
  const rows = await store.db
    .select()
    .from(events)
    .where(and(eq(events.orgId, store.orgId), eq(events.slug, slug)))
    .limit(1);
  const row = first(rows);
  return row ? toDetail(row) : null;
}

export async function insert(store: TenantStore, input: EventWrite): Promise<EventDetail> {
  const { events } = store.tables;
  const now = new Date();
  const id = newId("evt");
  await store.db.insert(events).values({
    city: input.city ?? null,
    coverUrl: input.coverUrl ?? null,
    createdAt: now,
    description: input.description ?? null,
    endsAt: input.endsAt ?? null,
    eventType: input.eventType ?? "meetup",
    feedbackUrl: input.feedbackUrl ?? null,
    footerText: input.footerText ?? null,
    headerText: input.headerText ?? null,
    id,
    isOnline: input.isOnline ?? false,
    location: input.location ?? null,
    lumaEventId: null,
    lumaUrl: input.lumaUrl ?? null,
    maxAttendees: input.maxAttendees ?? null,
    meetingUrl: input.meetingUrl ?? null,
    orgId: store.orgId,
    rsvpEnabled: input.rsvpEnabled ?? false,
    slug: input.slug,
    startsAt: input.startsAt,
    status: input.status ?? "draft",
    timezone: input.timezone ?? null,
    title: input.title,
    updatedAt: now,
  });
  const created = await getById(store, id);
  if (!created.ok) {
    throw new Error("insert event failed");
  }
  return created.event;
}

export async function updateById(
  store: TenantStore,
  id: string,
  patch: Partial<EventWrite>,
): Promise<Result<{ event: EventDetail }>> {
  const existing = await getById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { events } = store.tables;
  await store.db
    .update(events)
    .set(eventUpdateSet(patch))
    .where(and(eq(events.orgId, store.orgId), eq(events.id, id)));
  return getById(store, id);
}

export async function deleteById(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { events } = store.tables;
  await store.db.delete(events).where(and(eq(events.orgId, store.orgId), eq(events.id, id)));
  return ok({ success: true });
}

export async function listRsvps(
  store: TenantStore,
  eventId: string,
): Promise<{ userId: string; status: StoredRsvpStatus; createdAt: Date }[]> {
  const { eventRsvps } = store.tables;
  const rows = await store.db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.orgId, store.orgId), eq(eventRsvps.eventId, eventId)))
    .orderBy(desc(eventRsvps.createdAt));
  return rows.map((row) => ({
    createdAt: row.createdAt,
    status: row.status,
    userId: row.userId,
  }));
}

export async function findRsvp(
  store: TenantStore,
  eventId: string,
  userId: string,
): Promise<StoredRsvpStatus | null> {
  const { eventRsvps } = store.tables;
  const rows = await store.db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.orgId, store.orgId),
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.userId, userId),
      ),
    )
    .limit(1);
  const [rsvp] = rows;
  return rsvp?.status ?? null;
}

export async function upsertRsvp(
  store: TenantStore,
  eventId: string,
  userId: string,
  status: StoredRsvpStatus,
): Promise<void> {
  const { eventRsvps } = store.tables;
  const existing = await store.db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.orgId, store.orgId),
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.userId, userId),
      ),
    )
    .limit(1);
  const [current] = existing;
  if (current) {
    await store.db
      .update(eventRsvps)
      .set({ status })
      .where(and(eq(eventRsvps.orgId, store.orgId), eq(eventRsvps.id, current.id)));
    return;
  }
  await store.db.insert(eventRsvps).values({
    createdAt: new Date(),
    eventId,
    id: newId("rsvp"),
    orgId: store.orgId,
    status,
    userId,
  });
}

export async function deleteRsvpRow(
  store: TenantStore,
  eventId: string,
  userId: string,
): Promise<void> {
  const { eventRsvps } = store.tables;
  await store.db
    .delete(eventRsvps)
    .where(
      and(
        eq(eventRsvps.orgId, store.orgId),
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.userId, userId),
      ),
    );
}

export async function listGoingUserIds(store: TenantStore, eventId: string): Promise<string[]> {
  const { eventRsvps } = store.tables;
  const rows = await store.db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.orgId, store.orgId),
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.status, "going"),
      ),
    )
    .orderBy(asc(eventRsvps.createdAt), asc(eventRsvps.userId));
  return rows.map((row) => row.userId);
}

export async function listAgendaItems(
  store: TenantStore,
  eventId: string,
): Promise<AgendaItemDetail[]> {
  const { eventAgendaItems } = store.tables;
  const rows = await store.db
    .select()
    .from(eventAgendaItems)
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.eventId, eventId)))
    .orderBy(asc(eventAgendaItems.sortOrder));
  return rows.map(toAgenda);
}

export async function insertAgendaItem(
  store: TenantStore,
  eventId: string,
  input: {
    type: AgendaItemType;
    title?: string | null;
    description?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    speakerId?: string | null;
    sortOrder: number;
  },
): Promise<AgendaItemDetail> {
  const { eventAgendaItems } = store.tables;
  const now = new Date();
  const id = newId("agi");
  await store.db.insert(eventAgendaItems).values({
    createdAt: now,
    description: input.description ?? null,
    endsAt: input.endsAt ?? null,
    eventId,
    id,
    orgId: store.orgId,
    sortOrder: input.sortOrder,
    speakerId: input.speakerId ?? null,
    startsAt: input.startsAt ?? null,
    submissionId: null,
    title: input.title ?? null,
    type: input.type,
    updatedAt: now,
  });
  const rows = await store.db
    .select()
    .from(eventAgendaItems)
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    throw new Error("insert agenda item failed");
  }
  return toAgenda(row);
}

export async function updateAgendaItem(
  store: TenantStore,
  itemId: string,
  patch: {
    type?: AgendaItemType;
    title?: string | null;
    description?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    speakerId?: string | null;
    sortOrder?: number;
  },
): Promise<Result<{ item: AgendaItemDetail }>> {
  const { eventAgendaItems } = store.tables;
  const existing = await store.db
    .select()
    .from(eventAgendaItems)
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.id, itemId)))
    .limit(1);
  if (!first(existing)) {
    return err("not_found", 404, "Agenda item not found");
  }
  await store.db
    .update(eventAgendaItems)
    .set({
      ...(patch.type === undefined ? {} : { type: patch.type }),
      ...(patch.title === undefined ? {} : { title: patch.title ?? null }),
      ...(patch.description === undefined ? {} : { description: patch.description ?? null }),
      ...(patch.startsAt === undefined ? {} : { startsAt: patch.startsAt ?? null }),
      ...(patch.endsAt === undefined ? {} : { endsAt: patch.endsAt ?? null }),
      ...(patch.speakerId === undefined ? {} : { speakerId: patch.speakerId ?? null }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
      updatedAt: new Date(),
    })
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.id, itemId)));
  const rows = await store.db
    .select()
    .from(eventAgendaItems)
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.id, itemId)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Agenda item not found");
  }
  return ok({ item: toAgenda(row) });
}

export async function deleteAgendaItem(
  store: TenantStore,
  itemId: string,
): Promise<Result<{ success: true }>> {
  const { eventAgendaItems } = store.tables;
  const existing = await store.db
    .select()
    .from(eventAgendaItems)
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.id, itemId)))
    .limit(1);
  if (!first(existing)) {
    return err("not_found", 404, "Agenda item not found");
  }
  await store.db
    .delete(eventAgendaItems)
    .where(and(eq(eventAgendaItems.orgId, store.orgId), eq(eventAgendaItems.id, itemId)));
  return ok({ success: true });
}

export async function findLumaInterest(
  store: TenantStore,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { eventLumaInterests } = store.tables;
  const rows = await store.db
    .select()
    .from(eventLumaInterests)
    .where(
      and(
        eq(eventLumaInterests.orgId, store.orgId),
        eq(eventLumaInterests.eventId, eventId),
        eq(eventLumaInterests.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(first(rows));
}

export async function countLumaInterests(store: TenantStore, eventId: string): Promise<number> {
  const { eventLumaInterests } = store.tables;
  const rows = await store.db
    .select({ n: sql<number>`count(*)` })
    .from(eventLumaInterests)
    .where(and(eq(eventLumaInterests.orgId, store.orgId), eq(eventLumaInterests.eventId, eventId)));
  const [countRow] = rows;
  return Number(countRow?.n ?? 0);
}

export async function upsertLumaInterest(
  store: TenantStore,
  eventId: string,
  userId: string,
): Promise<void> {
  if (await findLumaInterest(store, eventId, userId)) {
    return;
  }
  const { eventLumaInterests } = store.tables;
  await store.db.insert(eventLumaInterests).values({
    createdAt: new Date(),
    eventId,
    id: newId("luma"),
    notifiedAt: null,
    orgId: store.orgId,
    userId,
  });
}

export async function listPendingLumaInterests(
  store: TenantStore,
  eventId: string,
): Promise<{ id: string; userId: string }[]> {
  const { eventLumaInterests } = store.tables;
  const rows = await store.db
    .select()
    .from(eventLumaInterests)
    .where(and(eq(eventLumaInterests.orgId, store.orgId), eq(eventLumaInterests.eventId, eventId)));
  return rows.filter((row) => !row.notifiedAt).map((row) => ({ id: row.id, userId: row.userId }));
}

export async function stampLumaNotified(store: TenantStore, interestId: string): Promise<void> {
  const { eventLumaInterests } = store.tables;
  await store.db
    .update(eventLumaInterests)
    .set({ notifiedAt: new Date() })
    .where(and(eq(eventLumaInterests.orgId, store.orgId), eq(eventLumaInterests.id, interestId)));
}

export async function listActiveLumaInterestsForUser(
  store: TenantStore,
  userId: string,
  now: Date,
): Promise<EventDetail[]> {
  const { eventLumaInterests, events } = store.tables;
  const rows = await store.db
    .select({ event: events })
    .from(eventLumaInterests)
    .innerJoin(events, eq(events.id, eventLumaInterests.eventId))
    .where(
      and(
        eq(eventLumaInterests.orgId, store.orgId),
        eq(eventLumaInterests.userId, userId),
        eq(events.status, "published"),
      ),
    )
    .orderBy(asc(events.startsAt));
  return rows
    .map((row) => toDetail(row.event))
    .filter((event) => !event.lumaUrl && event.startTime && new Date(event.startTime) > now);
}

export async function listSitemapEntries(
  store: TenantStore,
): Promise<{ id: string; slug: string; updatedAt: string }[]> {
  const { events } = store.tables;
  const rows = await store.db
    .select()
    .from(events)
    .where(and(eq(events.orgId, store.orgId), eq(events.status, "published")))
    .orderBy(asc(events.startsAt));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function deleteLumaInterest(
  store: TenantStore,
  eventId: string,
  userId: string,
): Promise<void> {
  const { eventLumaInterests } = store.tables;
  await store.db
    .delete(eventLumaInterests)
    .where(
      and(
        eq(eventLumaInterests.orgId, store.orgId),
        eq(eventLumaInterests.eventId, eventId),
        eq(eventLumaInterests.userId, userId),
      ),
    );
}
