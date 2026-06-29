/**
 * Event agenda service — admin-only CRUD + reorder for the per-event timeline.
 *
 * Each item is a "slot" of type "speaker" | "welcome" | "break" | "custom"
 * with optional time range, title, markdown description, and (for speakers)
 * an optional FK to a per-event Speaker row that carries the speaker's
 * content. Inline speaker fields no longer exist; link via `speakerId`.
 */

import { getPrisma } from "@/lib/prisma";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

export type AgendaItemType = "speaker" | "welcome" | "break" | "custom";
const AGENDA_TYPES: AgendaItemType[] = ["speaker", "welcome", "break", "custom"];

export interface AgendaItemInput {
  type?: AgendaItemType;
  startTime?: string | null;
  endTime?: string | null;
  title?: string | null;
  description?: string | null;
  speakerId?: string | null;
}

function parseDate(value: string | null | undefined, field: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ServiceError("bad_request", `Invalid ${field}`);
  return d;
}

interface SpeakerRel {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}

function serialize(item: {
  id: string;
  eventId: string;
  type: string;
  order: number;
  startTime: Date | null;
  endTime: Date | null;
  title: string | null;
  description: string | null;
  speakerId: string | null;
  speaker?: SpeakerRel | null;
  submissionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    eventId: item.eventId,
    type: item.type,
    order: item.order,
    startTime: item.startTime?.toISOString() ?? null,
    endTime: item.endTime?.toISOString() ?? null,
    title: item.title,
    description: item.description,
    speakerId: item.speakerId,
    speaker: item.speaker
      ? {
          id: item.speaker.id,
          name: item.speaker.name,
          title: item.speaker.title,
          company: item.speaker.company,
          bio: item.speaker.bio,
          talkTitle: item.speaker.talkTitle,
          talkDescription: item.speaker.talkDescription,
          headshotUrl: item.speaker.headshotUrl,
          companyLogoUrl: item.speaker.companyLogoUrl,
          twitterHandle: item.speaker.twitterHandle,
          linkedinUrl: item.speaker.linkedinUrl,
          websiteUrl: item.speaker.websiteUrl,
        }
      : null,
    submissionId: item.submissionId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listAgenda(actor: ActorLike, eventId: string) {
  const db = await getPrisma();
  ensurePermission(actor, "events.view");
  const items = await db.eventAgendaItem.findMany({
    where: { eventId },
    orderBy: { order: "asc" },
    include: { speaker: true },
  });
  return items.map(serialize);
}

export async function addAgendaItem(actor: ActorLike, eventId: string, input: AgendaItemInput) {
  const db = await getPrisma();
  ensurePermission(actor, "events.edit");
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new ServiceError("not_found", "Event not found");

  const type = input.type ?? "custom";
  if (!AGENDA_TYPES.includes(type)) {
    throw new ServiceError("bad_request", `Invalid agenda item type: ${type}`);
  }

  const last = await db.eventAgendaItem.findFirst({
    where: { eventId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const created = await db.eventAgendaItem.create({
    data: {
      eventId,
      type,
      order: nextOrder,
      startTime: parseDate(input.startTime, "startTime"),
      endTime: parseDate(input.endTime, "endTime"),
      title: input.title ?? null,
      description: input.description ?? null,
      speakerId: input.speakerId ?? null,
    },
    include: { speaker: true },
  });
  return serialize(created);
}

export async function updateAgendaItem(actor: ActorLike, itemId: string, input: AgendaItemInput) {
  const db = await getPrisma();
  ensurePermission(actor, "events.edit");
  if (input.type && !AGENDA_TYPES.includes(input.type)) {
    throw new ServiceError("bad_request", `Invalid agenda item type: ${input.type}`);
  }

  const data: Record<string, unknown> = {};
  if (input.type !== undefined) data.type = input.type;
  if (input.startTime !== undefined) data.startTime = parseDate(input.startTime, "startTime");
  if (input.endTime !== undefined) data.endTime = parseDate(input.endTime, "endTime");
  if (input.title !== undefined) data.title = input.title || null;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.speakerId !== undefined) data.speakerId = input.speakerId || null;

  const updated = await db.eventAgendaItem.update({
    where: { id: itemId },
    data,
    include: { speaker: true },
  });
  return serialize(updated);
}

export async function deleteAgendaItem(actor: ActorLike, itemId: string) {
  const db = await getPrisma();
  ensurePermission(actor, "events.edit");
  await db.eventAgendaItem.delete({ where: { id: itemId } });
  return { success: true };
}

export interface ReorderEntry {
  id: string;
  startTime?: string | null;
  endTime?: string | null;
}

export async function reorderAgenda(actor: ActorLike, eventId: string, entries: ReorderEntry[]) {
  const db = await getPrisma();
  ensurePermission(actor, "events.edit");
  if (!Array.isArray(entries)) {
    throw new ServiceError("bad_request", "entries must be an array");
  }

  const existing = await db.eventAgendaItem.findMany({
    where: { eventId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));
  if (entries.length !== existingIds.size || entries.some((e) => !existingIds.has(e.id))) {
    throw new ServiceError("bad_request", "entries must reference exactly the event's items");
  }

  // Sequential updates — D1 adapter does not support interactive $transaction.
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const data: Record<string, unknown> = { order: i };
    if (entry.startTime !== undefined) data.startTime = parseDate(entry.startTime, "startTime");
    if (entry.endTime !== undefined) data.endTime = parseDate(entry.endTime, "endTime");
    await db.eventAgendaItem.update({ where: { id: entry.id }, data });
  }
  return { success: true };
}
