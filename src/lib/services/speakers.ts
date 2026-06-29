/**
 * Per-event speaker service. Speakers are the source of truth for both the
 * agenda's speaker-type slots and the slide generator. A speaker carries
 * their talk title + description so it flows between views consistently.
 *
 * TalkSubmission CRUD lives in ./talks.ts. The only crossover is
 * `createSpeakerFromSubmission` below, which promotes a TalkSubmission
 * into a per-event Speaker, copying the richer talk fields.
 */
import { getPrisma } from "@/lib/prisma";
import { isStorageUrl } from "@/lib/storage";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";
import { invalidateForSpeaker } from "./slideRenderInvalidation";

export interface SpeakerInput {
  name?: string | null;
  title?: string | null;
  company?: string | null;
  bio?: string | null;
  talkTitle?: string | null;
  talkDescription?: string | null;
  talkDescriptionShort?: string | null;
  headshotUrl?: string | null;
  companyLogoUrl?: string | null;
  twitterHandle?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
}

function validateUrl(url: string | null | undefined, field: string): void {
  if (!url) return;
  if (!isStorageUrl(url)) {
    throw new ServiceError("bad_request", `${field} must be a storage URL`);
  }
}

// Optional nullable-string fields that map to `input[field] || null` when present.
const NULLABLE_STRING_FIELDS = [
  "title",
  "company",
  "bio",
  "talkTitle",
  "talkDescription",
  "talkDescriptionShort",
  "headshotUrl",
  "companyLogoUrl",
  "twitterHandle",
  "linkedinUrl",
  "websiteUrl",
] as const;

function applyNullableStringFields(input: SpeakerInput, data: Record<string, unknown>): void {
  for (const field of NULLABLE_STRING_FIELDS) {
    if (input[field] !== undefined) data[field] = input[field] || null;
  }
}

function serialize(s: {
  id: string;
  eventId: string;
  order: number;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  talkDescriptionShort: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  submissionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    eventId: s.eventId,
    order: s.order,
    name: s.name,
    title: s.title,
    company: s.company,
    bio: s.bio,
    talkTitle: s.talkTitle,
    talkDescription: s.talkDescription,
    talkDescriptionShort: s.talkDescriptionShort,
    headshotUrl: s.headshotUrl,
    companyLogoUrl: s.companyLogoUrl,
    twitterHandle: s.twitterHandle,
    linkedinUrl: s.linkedinUrl,
    websiteUrl: s.websiteUrl,
    submissionId: s.submissionId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export type SerializedSpeaker = ReturnType<typeof serialize>;

export async function listSpeakers(actor: ActorLike, eventId: string) {
  ensurePermission(actor, "speakers.view");
  const db = await getPrisma();
  const rows = await db.speaker.findMany({
    where: { eventId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serialize);
}

/**
 * Internal lookup used by the signed slide-render pipeline. Authenticated
 * via HMAC signature on the calling URL, not via the actor — do not export
 * through any API surface.
 */
export async function getSpeakerInternal(speakerId: string) {
  const db = await getPrisma();
  const row = await db.speaker.findUnique({ where: { id: speakerId } });
  return row ? serialize(row) : null;
}

/**
 * Admin-gated single-speaker lookup. Use this from API routes that need to
 * read one speaker by id (rather than listing every event speaker).
 */
export async function getSpeaker(actor: ActorLike, speakerId: string) {
  ensurePermission(actor, "speakers.view");
  const db = await getPrisma();
  const row = await db.speaker.findUnique({ where: { id: speakerId } });
  return row ? serialize(row) : null;
}

export async function createSpeaker(actor: ActorLike, eventId: string, input: SpeakerInput) {
  ensurePermission(actor, "speakers.edit");
  const db = await getPrisma();
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new ServiceError("not_found", "Event not found");

  validateUrl(input.headshotUrl, "headshotUrl");
  validateUrl(input.companyLogoUrl, "companyLogoUrl");

  const name = (input.name ?? "").trim();
  if (!name) throw new ServiceError("bad_request", "name is required");

  const last = await db.speaker.findFirst({
    where: { eventId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  const created = await db.speaker.create({
    data: {
      eventId,
      order: nextOrder,
      name,
      title: input.title ?? null,
      company: input.company ?? null,
      bio: input.bio ?? null,
      talkTitle: input.talkTitle ?? null,
      talkDescription: input.talkDescription ?? null,
      talkDescriptionShort: input.talkDescriptionShort ?? null,
      headshotUrl: input.headshotUrl ?? null,
      companyLogoUrl: input.companyLogoUrl ?? null,
      twitterHandle: input.twitterHandle ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      websiteUrl: input.websiteUrl ?? null,
    },
  });
  return serialize(created);
}

export async function createSpeakerFromSubmission(
  actor: ActorLike,
  eventId: string,
  submissionId: string,
) {
  ensurePermission(actor, "speakers.edit");
  const db = await getPrisma();
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new ServiceError("not_found", "Event not found");

  const submission = await db.talkSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new ServiceError("not_found", "Talk submission not found");

  const last = await db.speaker.findFirst({
    where: { eventId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  // Copy the talk-content fields too: title + description carry over so the
  // event-prep UI doesn't need to retype what the speaker already wrote.
  const created = await db.speaker.create({
    data: {
      eventId,
      order: nextOrder,
      name: submission.name,
      bio: submission.bio ?? null,
      talkTitle: submission.title,
      talkDescription: submission.description ?? null,
      submissionId: submission.id,
    },
  });
  return serialize(created);
}

export async function updateSpeaker(actor: ActorLike, speakerId: string, input: SpeakerInput) {
  ensurePermission(actor, "speakers.edit");
  const db = await getPrisma();
  if (input.headshotUrl !== undefined) validateUrl(input.headshotUrl, "headshotUrl");
  if (input.companyLogoUrl !== undefined) validateUrl(input.companyLogoUrl, "companyLogoUrl");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = (input.name ?? "").trim();
    if (!name) throw new ServiceError("bad_request", "name cannot be empty");
    data.name = name;
  }
  applyNullableStringFields(input, data);

  const updated = await db.speaker.update({ where: { id: speakerId }, data });
  await invalidateForSpeaker(speakerId);
  return serialize(updated);
}

export async function deleteSpeaker(actor: ActorLike, speakerId: string) {
  ensurePermission(actor, "speakers.delete");
  const db = await getPrisma();
  await db.speaker.delete({ where: { id: speakerId } });
  await invalidateForSpeaker(speakerId);
  return { success: true };
}

export async function reorderSpeakers(actor: ActorLike, eventId: string, ids: string[]) {
  ensurePermission(actor, "speakers.edit");
  if (!Array.isArray(ids)) {
    throw new ServiceError("bad_request", "ids must be an array");
  }
  const db = await getPrisma();
  const existing = await db.speaker.findMany({ where: { eventId }, select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
    throw new ServiceError("bad_request", "ids must reference exactly the event's speakers");
  }
  for (let i = 0; i < ids.length; i++) {
    await db.speaker.update({ where: { id: ids[i] }, data: { order: i } });
  }
  return { success: true };
}

// SpeakerSubmission CRUD moved to ./talks.ts (renamed TalkSubmission).
// Backwards-compatible re-exports so existing imports of
// createSpeakerSubmission / listSpeakerSubmissions / etc. keep working
// without breaking MCP tool surfaces during the migration.
export {
  createTalkSubmission as createSpeakerSubmission,
  deleteTalkSubmission as deleteSpeakerSubmission,
  listTalkSubmissions as listSpeakerSubmissions,
  type SerializedTalkSubmission as SerializedSpeakerSubmission,
  setTalkStatus as updateSpeakerSubmissionStatus,
  type TalkSubmissionInput as SpeakerSubmissionInput,
  type TalkSubmissionStatus as SpeakerSubmissionStatus,
} from "./talks";
