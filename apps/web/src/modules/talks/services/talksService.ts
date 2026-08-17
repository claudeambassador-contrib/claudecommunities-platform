// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as talksRepo from "@/modules/talks/repositories/talksRepository";
import type {
  SpeakerDetail,
  SpeakerInput,
  SpeakerWrite,
  TalkDetail,
  TalkListOptions,
  TalkLocksInput,
  TalkSubmissionInput,
  TalkSubmissionStatus,
  TalkWrite,
} from "@/modules/talks/types";
import { isStorageUrl, isValidEmail } from "@/modules/talks/validators";
import type { Actor } from "@/shared/auth/actor";
import { ensureOwnerOrPermission, ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

const VALID_STATUSES: readonly TalkSubmissionStatus[] = ["pending", "approved", "declined"];

const NULLABLE_SPEAKER_FIELDS = [
  "bio",
  "company",
  "companyLogoUrl",
  "headshotUrl",
  "linkedinUrl",
  "talkDescription",
  "talkDescriptionShort",
  "talkTitle",
  "title",
  "twitterHandle",
  "websiteUrl",
] as const;

function isTalkAdmin(actor: Actor): boolean {
  return ensurePermission(actor, "speakers.edit").ok;
}

function requireOwnerOrAdmin(actor: Actor, ownerId: string | null): Result<Record<string, never>> {
  return ensureOwnerOrPermission(actor, ownerId ?? "", "speakers.edit");
}

function validateStorageUrl(
  url: string | null | undefined,
  field: string,
): Result<{ valid: true }> {
  if (!url) {
    return ok({ valid: true });
  }
  if (!isStorageUrl(url)) {
    return err("bad_request", 400, `${field} must be a storage URL`);
  }
  return ok({ valid: true });
}

function nullableSpeakerPatch(input: SpeakerInput): Partial<SpeakerWrite> {
  const patch: Partial<SpeakerWrite> = {};
  for (const field of NULLABLE_SPEAKER_FIELDS) {
    if (input[field] !== undefined) {
      patch[field] = input[field] || null;
    }
  }
  return patch;
}

function talkContentPatch(input: TalkSubmissionInput): Result<{ patch: Partial<TalkWrite> }> {
  const patch: Partial<TalkWrite> = {};
  if (input.name !== undefined) {
    const name = (input.name ?? "").trim();
    if (!name) {
      return err("bad_request", 400, "Name cannot be empty");
    }
    patch.name = name;
  }
  if (input.email !== undefined) {
    const email = (input.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return err("bad_request", 400, "Valid email is required");
    }
    patch.email = email;
  }
  if (input.title !== undefined) {
    const title = (input.title ?? "").trim();
    if (!title) {
      return err("bad_request", 400, "Title cannot be empty");
    }
    patch.title = title;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.bio !== undefined) {
    patch.bio = input.bio?.trim() || null;
  }
  if (input.city !== undefined) {
    patch.city = input.city?.trim() || null;
  }
  return ok({ patch });
}

export async function createTalkSubmission(
  store: TenantStore,
  actor: Actor,
  input: TalkSubmissionInput,
): Promise<Result<{ talk: TalkDetail }>> {
  const name = (input.name ?? "").trim();
  if (!name) {
    return err("bad_request", 400, "Name is required");
  }
  const email = (input.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return err("bad_request", 400, "Valid email is required");
  }
  const title = (input.title ?? "").trim();
  if (!title) {
    return err("bad_request", 400, "Talk title is required");
  }
  return await talksRepo.insertTalk(store, {
    bio: input.bio?.trim() || null,
    city: input.city?.trim() || null,
    description: input.description?.trim() || null,
    email,
    name,
    title,
    userId: actor.id,
  });
}

export async function listTalkSubmissions(
  store: TenantStore,
  actor: Actor,
  options: TalkListOptions = {},
): Promise<Result<{ talks: TalkDetail[] }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  return ok({ talks: await talksRepo.listTalks(store, options) });
}

export async function listUserTalks(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ talks: TalkDetail[] }>> {
  return ok({ talks: await talksRepo.listTalksForUser(store, actor.id) });
}

export async function getTalk(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ talk: TalkDetail }>> {
  const found = await talksRepo.getTalkById(store, id);
  if (!found.ok) {
    return found;
  }
  const allowed = requireOwnerOrAdmin(actor, found.talk.userId);
  if (!allowed.ok) {
    return allowed;
  }
  return found;
}

export async function updateTalkContent(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: TalkSubmissionInput,
): Promise<Result<{ talk: TalkDetail }>> {
  const found = await talksRepo.getTalkById(store, id);
  if (!found.ok) {
    return found;
  }
  const allowed = requireOwnerOrAdmin(actor, found.talk.userId);
  if (!allowed.ok) {
    return allowed;
  }
  if (found.talk.contentLocked && !isTalkAdmin(actor)) {
    return err("forbidden", 403, "This talk is locked for editing");
  }

  const built = talkContentPatch(input);
  if (!built.ok) {
    return built;
  }
  if (Object.keys(built.patch).length === 0) {
    return found;
  }
  return await talksRepo.updateTalkById(store, id, built.patch);
}

export async function setTalkStatus(
  store: TenantStore,
  actor: Actor,
  id: string,
  status: TalkSubmissionStatus,
): Promise<Result<{ talk: TalkDetail }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!VALID_STATUSES.includes(status)) {
    return err("bad_request", 400, "status must be pending, approved, or declined");
  }
  return await talksRepo.updateTalkById(store, id, { status });
}

export async function setTalkLocks(
  store: TenantStore,
  actor: Actor,
  id: string,
  locks: TalkLocksInput,
): Promise<Result<{ talk: TalkDetail }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  const patch: Partial<TalkWrite> = {};
  if (locks.contentLocked !== undefined) {
    patch.contentLocked = locks.contentLocked;
  }
  if (locks.slidesLocked !== undefined) {
    patch.slidesLocked = locks.slidesLocked;
  }
  if (Object.keys(patch).length === 0) {
    return err("bad_request", 400, "At least one lock flag is required");
  }
  return await talksRepo.updateTalkById(store, id, patch);
}

export async function setTalkDeleted(
  store: TenantStore,
  actor: Actor,
  id: string,
  deleted: boolean,
): Promise<Result<{ talk: TalkDetail }>> {
  const perm = ensurePermission(actor, "speakers.delete");
  if (!perm.ok) {
    return perm;
  }
  return await talksRepo.updateTalkById(store, id, { deletedAt: deleted ? new Date() : null });
}

export async function deleteTalkSubmission(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const found = await talksRepo.getTalkById(store, id);
  if (!found.ok) {
    return found;
  }
  if (!isTalkAdmin(actor)) {
    if (found.talk.userId !== actor.id) {
      return err("forbidden", 403, "Not allowed");
    }
    if (found.talk.status !== "pending" || found.talk.contentLocked || found.talk.slidesLocked) {
      return err("forbidden", 403, "Cannot delete a talk after it has been reviewed or locked");
    }
  }
  return await talksRepo.deleteTalkById(store, id);
}

export async function listSpeakers(
  store: TenantStore,
  actor: Actor,
  eventId: string,
): Promise<Result<{ speakers: SpeakerDetail[] }>> {
  const perm = ensurePermission(actor, "speakers.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ speakers: await talksRepo.listSpeakersForEvent(store, eventId) });
}

export async function getSpeaker(
  store: TenantStore,
  actor: Actor,
  speakerId: string,
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const perm = ensurePermission(actor, "speakers.view");
  if (!perm.ok) {
    return perm;
  }
  return await talksRepo.getSpeakerById(store, speakerId);
}

export async function createSpeaker(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  input: SpeakerInput,
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!(await talksRepo.eventExists(store, eventId))) {
    return err("not_found", 404, "Event not found");
  }
  const headshot = validateStorageUrl(input.headshotUrl, "headshotUrl");
  if (!headshot.ok) {
    return headshot;
  }
  const logo = validateStorageUrl(input.companyLogoUrl, "companyLogoUrl");
  if (!logo.ok) {
    return logo;
  }
  const name = (input.name ?? "").trim();
  if (!name) {
    return err("bad_request", 400, "name is required");
  }
  return await talksRepo.insertSpeaker(store, {
    bio: input.bio ?? null,
    company: input.company ?? null,
    companyLogoUrl: input.companyLogoUrl ?? null,
    eventId,
    headshotUrl: input.headshotUrl ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    name,
    sortOrder: await talksRepo.nextSpeakerOrder(store, eventId),
    talkDescription: input.talkDescription ?? null,
    talkDescriptionShort: input.talkDescriptionShort ?? null,
    talkTitle: input.talkTitle ?? null,
    title: input.title ?? null,
    twitterHandle: input.twitterHandle ?? null,
    websiteUrl: input.websiteUrl ?? null,
  });
}

export async function createSpeakerFromSubmission(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  submissionId: string,
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!(await talksRepo.eventExists(store, eventId))) {
    return err("not_found", 404, "Event not found");
  }
  const submission = await talksRepo.getTalkById(store, submissionId);
  if (!submission.ok) {
    return submission;
  }
  return await talksRepo.insertSpeaker(store, {
    bio: submission.talk.bio,
    eventId,
    name: submission.talk.name,
    sortOrder: await talksRepo.nextSpeakerOrder(store, eventId),
    submissionId: submission.talk.id,
    talkDescription: submission.talk.description,
    talkTitle: submission.talk.title,
  });
}

export async function updateSpeaker(
  store: TenantStore,
  actor: Actor,
  speakerId: string,
  input: SpeakerInput,
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  if (input.headshotUrl !== undefined) {
    const headshot = validateStorageUrl(input.headshotUrl, "headshotUrl");
    if (!headshot.ok) {
      return headshot;
    }
  }
  if (input.companyLogoUrl !== undefined) {
    const logo = validateStorageUrl(input.companyLogoUrl, "companyLogoUrl");
    if (!logo.ok) {
      return logo;
    }
  }
  const patch: Partial<SpeakerWrite> = nullableSpeakerPatch(input);
  if (input.name !== undefined) {
    const name = (input.name ?? "").trim();
    if (!name) {
      return err("bad_request", 400, "name cannot be empty");
    }
    patch.name = name;
  }
  return await talksRepo.updateSpeakerById(store, speakerId, patch);
}

export async function deleteSpeaker(
  store: TenantStore,
  actor: Actor,
  speakerId: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "speakers.delete");
  if (!perm.ok) {
    return perm;
  }
  return await talksRepo.deleteSpeakerById(store, speakerId);
}

export async function reorderSpeakers(
  store: TenantStore,
  actor: Actor,
  eventId: string,
  ids: string[],
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "speakers.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await talksRepo.listSpeakersForEvent(store, eventId);
  const existingIds = new Set(existing.map((speaker) => speaker.id));
  if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
    return err("bad_request", 400, "ids must reference exactly the event's speakers");
  }
  for (const [index, id] of ids.entries()) {
    // D1 has no interactive transaction — apply order one row at a time.
    // biome-ignore lint/performance/noAwaitInLoops: sequential D1 writes
    const updated = await talksRepo.updateSpeakerById(store, id, { sortOrder: index });
    if (!updated.ok) {
      return updated;
    }
  }
  return ok({ success: true });
}
