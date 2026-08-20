// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as talksRepo from "@/modules/talks/repositories/talksRepository";
import {
  speakerCreateInput,
  speakerPatchInput,
  talkSubmissionCreateInput,
  talkSubmissionPatchInput,
} from "@/modules/talks/schemas";
import type {
  SpeakerDetail,
  SpeakerInput,
  TalkComment,
  TalkDetail,
  TalkListOptions,
  TalkLocksInput,
  TalkPatch,
  TalkSubmissionInput,
  TalkSubmissionStatus,
} from "@/modules/talks/types";
import type { Actor } from "@/shared/auth/actor";
import { ensureOwnerOrPermission, ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { type Empty, err, ok, type Result } from "@/shared/http/errors";

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

function requireOwnerOrAdmin(actor: Actor, ownerId: string | null): Result<Empty> {
  return ensureOwnerOrPermission(actor, ownerId ?? "", "speakers.edit");
}

function nullableSpeakerPatch(input: SpeakerInput): SpeakerInput {
  const patch: SpeakerInput = {};
  for (const field of NULLABLE_SPEAKER_FIELDS) {
    if (input[field] !== undefined) {
      patch[field] = input[field] || null;
    }
  }
  return patch;
}

function talkContentPatch(input: TalkSubmissionInput): Result<{ patch: TalkPatch }> {
  const parsed = talkSubmissionPatchInput.safeParse(input);
  if (!parsed.success) {
    return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { data } = parsed;
  const patch: TalkPatch = {};
  if (data.name !== undefined) {
    patch.name = data.name;
  }
  if (data.email !== undefined) {
    patch.email = data.email;
  }
  if (data.title !== undefined) {
    patch.title = data.title;
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
  const parsed = talkSubmissionCreateInput.safeParse(input);
  if (!parsed.success) {
    return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { data } = parsed;
  return await talksRepo.insertTalk(store, {
    bio: data.bio?.trim() || null,
    city: data.city?.trim() || null,
    description: data.description?.trim() || null,
    email: data.email,
    name: data.name,
    title: data.title,
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
  const patch: TalkPatch = {};
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
  return await talksRepo.updateTalkById(store, id, { deleted });
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
  const parsed = speakerCreateInput.safeParse(input);
  if (!parsed.success) {
    return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return await talksRepo.insertSpeaker(store, eventId, {
    ...input,
    name: parsed.data.name,
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
  return await talksRepo.insertSpeaker(store, eventId, {
    bio: submission.talk.bio,
    name: submission.talk.name,
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
  const parsed = speakerPatchInput.safeParse(input);
  if (!parsed.success) {
    return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const patch: SpeakerInput = nullableSpeakerPatch(input);
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name;
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

export async function listTalkComments(
  store: TenantStore,
  actor: Actor,
  submissionId: string,
): Promise<Result<{ comments: TalkComment[] }>> {
  const found = await talksRepo.getTalkById(store, submissionId);
  if (!found.ok) {
    return found;
  }
  const allowed = requireOwnerOrAdmin(actor, found.talk.userId);
  if (!allowed.ok) {
    return allowed;
  }
  return ok({ comments: await talksRepo.listTalkComments(store, submissionId) });
}

export async function createTalkComment(
  store: TenantStore,
  actor: Actor,
  submissionId: string,
  content: string,
): Promise<Result<{ comment: TalkComment }>> {
  const found = await talksRepo.getTalkById(store, submissionId);
  if (!found.ok) {
    return found;
  }
  const allowed = requireOwnerOrAdmin(actor, found.talk.userId);
  if (!allowed.ok) {
    return allowed;
  }
  if (found.talk.contentLocked && !isTalkAdmin(actor)) {
    return err("forbidden", 403, "This talk is locked — comments are read-only");
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return err("bad_request", 400, "Comment cannot be empty");
  }
  if (trimmed.length > 10_000) {
    return err("bad_request", 400, "Comment is too long");
  }
  return ok({
    comment: await talksRepo.insertTalkComment(store, {
      authorId: actor.id,
      content: trimmed,
      submissionId,
    }),
  });
}

export async function deleteTalkComment(
  store: TenantStore,
  actor: Actor,
  commentId: string,
): Promise<Result<{ success: true }>> {
  const existing = await talksRepo.getTalkCommentById(store, commentId);
  if (!existing.ok) {
    return existing;
  }
  if (!isTalkAdmin(actor) && existing.comment.authorId !== actor.id) {
    return err("forbidden", 403, "Not allowed");
  }
  return await talksRepo.deleteTalkCommentById(store, commentId);
}
