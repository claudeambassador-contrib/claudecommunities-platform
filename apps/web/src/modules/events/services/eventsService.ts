// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as eventsRepo from "@/modules/events/repositories/eventsRepository";
import { eventWriteInput, isAllowedResourceUrl } from "@/modules/events/schemas";
import type {
  AgendaItemDetail,
  AgendaItemInput,
  AgendaItemType,
  Clock,
  EventCreateInput,
  EventDetail,
  EventResourceDetail,
  EventResourceInput,
  EventWrite,
  EventWriteInput,
  LumaWaitlistNotifier,
  PublicEventDetail,
  ReorderEntry,
  RsvpCounts,
  RsvpStats,
  RsvpStatus,
  StoredRsvpStatus,
} from "@/modules/events/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
import { toSafeSlug } from "@/shared/ids";

const AGENDA_TYPES = new Set<AgendaItemType>(["speaker", "welcome", "break", "custom"]);

/**
 * Strip the fields an unauthenticated visitor must not receive before an
 * `EventDetail` is serialized into a public page payload. Only `meetingUrl`
 * qualifies today: it is the private join link, handed out to attendees
 * through the RSVP flow rather than the public event page. Everything else on
 * `EventDetail` is already public page content.
 */
export function toPublicEventDetail(event: EventDetail): PublicEventDetail {
  const { meetingUrl: _meetingUrl, ...publicEvent } = event;
  return publicEvent;
}

function parseDate(value: string | null | undefined, field: string): Result<{ date: Date | null }> {
  if (!value) {
    return ok({ date: null });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return err("bad_request", 400, `Invalid ${field}`);
  }
  return ok({ date });
}

function buildDateSlug(title: string, startTime: Date): string {
  const month = startTime.toLocaleString("en-US", { month: "long" }).toLowerCase();
  const year = startTime.getFullYear();
  return `${toSafeSlug(title)}-${month}-${year}`;
}

async function uniqueSlug(store: TenantStore, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // Sequential lookup: each candidate depends on the previous miss.
  // oxlint-disable-next-line no-await-in-loop -- uniqueness is checked one slug at a time
  while (await eventsRepo.findBySlug(store, candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * `title` and `eventType` back NOT NULL columns, so an explicit null is
 * treated as "absent" (the field is left unchanged) rather than copied into
 * the UPDATE — matching the old `!== undefined` guards and the insert path's
 * `input.eventType ?? "meetup"` default.
 */
function toNotNullPatch(input: EventWriteInput): Partial<EventWrite> {
  const patch: Partial<EventWrite> = {};
  if (input.title !== undefined && input.title !== null) {
    patch.title = input.title;
  }
  if (input.eventType !== undefined && input.eventType !== null) {
    patch.eventType = input.eventType;
  }
  return patch;
}

function toEventWritePatch(
  input: EventWriteInput,
  start?: { date: Date | null },
  end?: { date: Date | null },
): Partial<EventWrite> {
  const patch: Partial<EventWrite> = toNotNullPatch(input);
  if (input.description !== undefined) {
    patch.description = input.description;
  }
  if (input.location !== undefined) {
    patch.location = input.location;
  }
  if (input.city !== undefined) {
    patch.city = input.city;
  }
  if (input.timezone !== undefined) {
    patch.timezone = input.timezone;
  }
  if (start !== undefined) {
    patch.startsAt = start.date ?? undefined;
  }
  if (end !== undefined) {
    patch.endsAt = end.date;
  }
  if (input.maxAttendees !== undefined) {
    patch.maxAttendees = input.maxAttendees;
  }
  if (input.isOnline !== undefined) {
    patch.isOnline = input.isOnline;
  }
  if (input.meetingUrl !== undefined) {
    patch.meetingUrl = input.meetingUrl;
  }
  if (input.lumaUrl !== undefined) {
    patch.lumaUrl = input.lumaUrl;
  }
  if (input.coverUrl !== undefined) {
    patch.coverUrl = input.coverUrl;
  }
  if (input.rsvpEnabled !== undefined) {
    patch.rsvpEnabled = input.rsvpEnabled;
  }
  if (input.isActive !== undefined) {
    patch.status = statusFromActive(input.isActive);
  }
  if (input.headerText !== undefined) {
    patch.headerText = input.headerText;
  }
  if (input.footerText !== undefined) {
    patch.footerText = input.footerText;
  }
  if (input.feedbackUrl !== undefined) {
    patch.feedbackUrl = input.feedbackUrl;
  }
  return patch;
}

function validateInput(input: EventWriteInput): Result<{ valid: true }> {
  const parsed = eventWriteInput.safeParse(input);
  if (!parsed.success) {
    return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return ok({ valid: true });
}

function statusFromActive(isActive: boolean | undefined): "draft" | "published" {
  return isActive === false ? "draft" : "published";
}

export async function listEvents(
  store: TenantStore,
  options: { includeInactive?: boolean } = {},
): Promise<Result<{ events: EventDetail[] }>> {
  return ok({ events: await eventsRepo.listEvents(store, options) });
}

export async function getEvent(
  store: TenantStore,
  id: string,
  options: { includeInactive?: boolean } = {},
): Promise<Result<{ event: EventDetail }>> {
  const found = await eventsRepo.getById(store, id);
  if (!found.ok) {
    return found;
  }
  if (!options.includeInactive && found.event.status !== "published") {
    return err("not_found", 404, "Event not found");
  }
  return found;
}

export async function getEventBySlugOrId(
  store: TenantStore,
  slugOrId: string,
  options: { includeInactive?: boolean } = {},
): Promise<Result<{ event: EventDetail }>> {
  const byId = await eventsRepo.getById(store, slugOrId);
  if (byId.ok) {
    if (!options.includeInactive && byId.event.status !== "published") {
      return err("not_found", 404, "Event not found");
    }
    return byId;
  }
  const bySlug = await eventsRepo.findBySlug(store, slugOrId);
  if (!bySlug) {
    return err("not_found", 404, "Event not found");
  }
  if (!options.includeInactive && bySlug.status !== "published") {
    return err("not_found", 404, "Event not found");
  }
  return ok({ event: bySlug });
}

export async function createEvent(
  store: TenantStore,
  actor: Actor,
  input: EventCreateInput,
): Promise<Result<{ event: EventDetail }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  const valid = validateInput(input);
  if (!valid.ok) {
    return valid;
  }
  const start = parseDate(input.startTime, "startTime");
  if (!start.ok) {
    return start;
  }
  if (!start.date) {
    return err("bad_request", 400, "Invalid startTime");
  }
  const end = parseDate(input.endTime, "endTime");
  if (!end.ok) {
    return end;
  }

  const slug = await uniqueSlug(store, buildDateSlug(input.title, start.date));
  return await eventsRepo.insert(store, {
    city: input.city,
    coverUrl: input.coverUrl,
    description: input.description,
    endsAt: end.date,
    eventType: input.eventType,
    feedbackUrl: input.feedbackUrl,
    footerText: input.footerText,
    headerText: input.headerText,
    isOnline: input.isOnline,
    location: input.location,
    lumaUrl: input.lumaUrl,
    maxAttendees: input.maxAttendees,
    meetingUrl: input.meetingUrl,
    rsvpEnabled: input.rsvpEnabled,
    slug,
    startsAt: start.date,
    status: statusFromActive(input.isActive),
    timezone: input.timezone,
    title: input.title,
  });
}

export async function updateEvent(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: EventWriteInput,
  notifier?: LumaWaitlistNotifier,
): Promise<Result<{ event: EventDetail }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  const valid = validateInput(input);
  if (!valid.ok) {
    return valid;
  }

  const start = input.startTime === undefined ? undefined : parseDate(input.startTime, "startTime");
  if (start && !start.ok) {
    return start;
  }
  const end = input.endTime === undefined ? undefined : parseDate(input.endTime, "endTime");
  if (end && !end.ok) {
    return end;
  }

  let priorLumaUrl: string | null = null;
  if (input.lumaUrl !== undefined) {
    const before = await eventsRepo.getById(store, id);
    if (!before.ok) {
      return before;
    }
    priorLumaUrl = before.event.lumaUrl;
  }

  const updated = await eventsRepo.updateById(
    store,
    id,
    toEventWritePatch(input, start?.ok ? start : undefined, end?.ok ? end : undefined),
  );
  if (!updated.ok) {
    return updated;
  }
  if (input.lumaUrl !== undefined && !priorLumaUrl && updated.event.lumaUrl) {
    await notifyLumaWaitlist(store, id, notifier);
  }
  return updated;
}

export async function setEventActive(
  store: TenantStore,
  actor: Actor,
  id: string,
  isActive: boolean,
): Promise<Result<{ event: EventDetail }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  return await eventsRepo.updateById(store, id, { status: statusFromActive(isActive) });
}

export async function deleteEvent(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "events.delete");
  if (!perm.ok) {
    return perm;
  }
  return await eventsRepo.deleteById(store, id);
}

export async function getRsvpStats(
  store: TenantStore,
  eventId: string,
  viewer?: Actor | null,
): Promise<Result<RsvpStats>> {
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok) {
    return found;
  }
  const rsvps = await eventsRepo.listRsvps(store, eventId);
  const going = rsvps.filter((r) => r.status === "going").map((r) => ({ id: r.userId }));
  const interested = rsvps.filter((r) => r.status === "interested").map((r) => ({ id: r.userId }));
  const userRsvp = viewer ? await eventsRepo.findRsvp(store, eventId, viewer.id) : null;
  return ok({
    counts: {
      going: going.length,
      interested: interested.length,
      total: rsvps.length,
    },
    going,
    interested,
    isAuthenticated: Boolean(viewer),
    userRsvp,
  });
}

async function rsvpCounts(store: TenantStore, eventId: string): Promise<RsvpCounts> {
  const rsvps = await eventsRepo.listRsvps(store, eventId);
  return {
    going: rsvps.filter((r) => r.status === "going").length,
    interested: rsvps.filter((r) => r.status === "interested").length,
  };
}

export async function rsvpToEvent(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  status: RsvpStatus,
): Promise<Result<{ success: true; status: StoredRsvpStatus | null; counts: RsvpCounts }>> {
  if (status !== "going" && status !== "interested" && status !== "not_going") {
    return err("bad_request", 400, "Invalid status. Must be 'going', 'interested', or 'not_going'");
  }
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok) {
    return found;
  }
  const { event } = found;
  if (!event.rsvpEnabled || event.lumaUrl) {
    return err("bad_request", 400, "Internal RSVP is not enabled for this event");
  }

  if (status === "not_going") {
    await eventsRepo.deleteRsvpRow(store, eventId, actor.id);
    return ok({ counts: await rsvpCounts(store, eventId), status: null, success: true });
  }

  if (status === "going" && event.maxAttendees) {
    const goingIds = await eventsRepo.listGoingUserIds(store, eventId);
    const alreadyGoing = goingIds.includes(actor.id);
    if (!alreadyGoing && goingIds.length >= event.maxAttendees) {
      return err("bad_request", 400, "Event is at maximum capacity");
    }
  }

  await eventsRepo.upsertRsvp(store, eventId, actor.id, status);

  if (status === "going" && event.maxAttendees) {
    const goingIds = await eventsRepo.listGoingUserIds(store, eventId);
    if (goingIds.indexOf(actor.id) >= event.maxAttendees) {
      await eventsRepo.deleteRsvpRow(store, eventId, actor.id);
      return err("bad_request", 400, "Event is at maximum capacity");
    }
  }

  return ok({ counts: await rsvpCounts(store, eventId), status, success: true });
}

export async function deleteRsvp(
  store: TenantStore,
  actor: Actor,
  eventId: string,
): Promise<Result<{ success: true }>> {
  await eventsRepo.deleteRsvpRow(store, eventId, actor.id);
  return ok({ success: true });
}

export async function listPublicAgenda(
  store: TenantStore,
  eventId: string,
): Promise<Result<{ items: AgendaItemDetail[] }>> {
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok) {
    return found;
  }
  return ok({ items: await eventsRepo.listAgendaItems(store, eventId) });
}

export async function listAgenda(
  store: TenantStore,
  actor: Actor,
  eventId: string,
): Promise<Result<{ items: AgendaItemDetail[] }>> {
  const perm = ensurePermission(actor, "events.view");
  if (!perm.ok) {
    return perm;
  }
  return await listPublicAgenda(store, eventId);
}

export async function addAgendaItem(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  input: AgendaItemInput,
): Promise<Result<{ item: AgendaItemDetail }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok) {
    return found;
  }
  const type = input.type ?? "custom";
  if (!AGENDA_TYPES.has(type)) {
    return err("bad_request", 400, `Invalid agenda item type: ${type}`);
  }
  const start = parseDate(input.startTime, "startTime");
  if (!start.ok) {
    return start;
  }
  const end = parseDate(input.endTime, "endTime");
  if (!end.ok) {
    return end;
  }
  const existing = await eventsRepo.listAgendaItems(store, eventId);
  const nextOrder = existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.order)) + 1;
  return await eventsRepo.insertAgendaItem(store, eventId, {
    description: input.description,
    endsAt: end.date,
    sortOrder: nextOrder,
    speakerId: input.speakerId,
    startsAt: start.date,
    title: input.title,
    type,
  });
}

export async function updateAgendaItem(
  store: TenantStore,
  actor: Actor,
  itemId: string,
  input: AgendaItemInput,
): Promise<Result<{ item: AgendaItemDetail }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  if (input.type && !AGENDA_TYPES.has(input.type)) {
    return err("bad_request", 400, `Invalid agenda item type: ${input.type}`);
  }
  const start = input.startTime === undefined ? undefined : parseDate(input.startTime, "startTime");
  if (start && !start.ok) {
    return start;
  }
  const end = input.endTime === undefined ? undefined : parseDate(input.endTime, "endTime");
  if (end && !end.ok) {
    return end;
  }
  return await eventsRepo.updateAgendaItem(store, itemId, {
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(start ? { startsAt: start.date } : {}),
    ...(end ? { endsAt: end.date } : {}),
    ...(input.speakerId === undefined ? {} : { speakerId: input.speakerId }),
  });
}

export async function deleteAgendaItem(
  store: TenantStore,
  actor: Actor,
  itemId: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  return await eventsRepo.deleteAgendaItem(store, itemId);
}

export async function reorderAgenda(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  entries: ReorderEntry[],
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await eventsRepo.listAgendaItems(store, eventId);
  const existingIds = new Set(existing.map((item) => item.id));
  if (entries.length !== existingIds.size || entries.some((entry) => !existingIds.has(entry.id))) {
    return err("bad_request", 400, "entries must reference exactly the event's items");
  }
  for (const [index, entry] of entries.entries()) {
    const start =
      entry.startTime === undefined ? undefined : parseDate(entry.startTime, "startTime");
    if (start && !start.ok) {
      return start;
    }
    const end = entry.endTime === undefined ? undefined : parseDate(entry.endTime, "endTime");
    if (end && !end.ok) {
      return end;
    }
    // D1 has no interactive transaction — apply order one row at a time.
    // oxlint-disable-next-line no-await-in-loop -- sequential D1 writes
    const updated = await eventsRepo.updateAgendaItem(store, entry.id, {
      sortOrder: index,
      ...(start ? { startsAt: start.date } : {}),
      ...(end ? { endsAt: end.date } : {}),
    });
    if (!updated.ok) {
      return updated;
    }
  }
  return ok({ success: true });
}

export async function registerLumaInterest(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  clock: Clock = { now: () => new Date() },
): Promise<Result<{ success: true; registered: true }>> {
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok || found.event.status !== "published") {
    return err("not_found", 404, "Event not found");
  }
  if (found.event.lumaUrl) {
    return err("bad_request", 400, "Luma link is already available — RSVP on Luma instead");
  }
  if (!found.event.startTime || new Date(found.event.startTime) <= clock.now()) {
    return err("bad_request", 400, "Event has already started");
  }
  await eventsRepo.upsertLumaInterest(store, eventId, actor.id);
  return ok({ registered: true, success: true });
}

export async function unregisterLumaInterest(
  store: TenantStore,
  actor: Actor,
  eventId: string,
): Promise<Result<{ success: true; registered: false }>> {
  await eventsRepo.deleteLumaInterest(store, eventId, actor.id);
  return ok({ registered: false, success: true });
}

export async function listEventSitemapEntries(
  store: TenantStore,
): Promise<Result<{ entries: { id: string; slug: string; updatedAt: string }[] }>> {
  return ok({ entries: await eventsRepo.listSitemapEntries(store) });
}

export async function listLumaInterestsForUser(
  store: TenantStore,
  actor: Actor,
  clock: Clock = { now: () => new Date() },
): Promise<Result<{ events: EventDetail[] }>> {
  return ok({
    events: await eventsRepo.listActiveLumaInterestsForUser(store, actor.id, clock.now()),
  });
}

export async function getLumaWaitlistCount(
  store: TenantStore,
  eventId: string,
): Promise<Result<{ count: number }>> {
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok) {
    return found;
  }
  return ok({ count: await eventsRepo.countLumaInterests(store, eventId) });
}

export async function notifyLumaWaitlist(
  store: TenantStore,
  eventId: string,
  notifier?: LumaWaitlistNotifier,
): Promise<Result<{ notified: number; failedEmails: number }>> {
  const found = await eventsRepo.getById(store, eventId);
  if (!(found.ok && found.event.lumaUrl)) {
    return ok({ failedEmails: 0, notified: 0 });
  }
  if (!notifier) {
    return ok({ failedEmails: 0, notified: 0 });
  }
  const pending = await eventsRepo.listPendingLumaInterests(store, eventId);
  let failedEmails = 0;
  let notified = 0;
  for (const row of pending) {
    try {
      // Stamp only after a successful fan-out so a missing or failed
      // notifier cannot burn the waitlist.
      // oxlint-disable-next-line no-await-in-loop -- notify-then-stamp is sequential
      await notifier.notify({
        eventId,
        lumaUrl: found.event.lumaUrl,
        title: found.event.title,
        userId: row.userId,
      });
      // oxlint-disable-next-line no-await-in-loop -- notify-then-stamp is sequential
      await eventsRepo.stampLumaNotified(store, row.id);
      notified += 1;
    } catch {
      failedEmails += 1;
    }
  }
  return ok({ failedEmails, notified });
}

export async function getLumaInterestStatus(
  store: TenantStore,
  eventId: string,
  viewer?: Actor | null,
): Promise<Result<{ registered: boolean; count: number; isAuthenticated: boolean }>> {
  const found = await eventsRepo.getById(store, eventId);
  if (!found.ok) {
    return found;
  }
  const count = await eventsRepo.countLumaInterests(store, eventId);
  const registered = viewer ? await eventsRepo.findLumaInterest(store, eventId, viewer.id) : false;
  return ok({
    count,
    isAuthenticated: Boolean(viewer),
    registered,
  });
}

export async function listEventResources(
  store: TenantStore,
  slugOrId: string,
): Promise<Result<{ event: EventDetail; resources: EventResourceDetail[] }>> {
  const found = await getEventBySlugOrId(store, slugOrId);
  if (!found.ok) {
    return found;
  }
  return ok({
    event: found.event,
    resources: await eventsRepo.listResources(store, found.event.id),
  });
}

export async function addEventResource(
  store: TenantStore,
  actor: Actor,
  slugOrId: string,
  input: EventResourceInput,
): Promise<Result<{ resource: EventResourceDetail }>> {
  const perm = ensurePermission(actor, "events.edit");
  if (!perm.ok) {
    return perm;
  }
  const title = input.title.trim();
  if (!title) {
    return err("bad_request", 400, "Title is required");
  }
  if (!isAllowedResourceUrl(input.fileUrl)) {
    return err("bad_request", 400, "Resource URL must be https");
  }
  const found = await getEventBySlugOrId(store, slugOrId, { includeInactive: true });
  if (!found.ok) {
    return found;
  }
  return ok({
    resource: await eventsRepo.insertResource(
      store,
      found.event.id,
      {
        description: input.description?.trim() || null,
        fileName: input.fileName?.trim() || title,
        fileUrl: input.fileUrl.trim(),
        mimeType: input.mimeType,
        title,
      },
      actor.id,
    ),
  });
}
