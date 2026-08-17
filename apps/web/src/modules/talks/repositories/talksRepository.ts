import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { SpeakerRow, TalkSubmissionRow } from "@/modules/talks/schema.tenant";
import type {
  SpeakerDetail,
  SpeakerInput,
  TalkComment,
  TalkDetail,
  TalkListOptions,
  TalkPatch,
  TalkSubmissionInput,
} from "@/modules/talks/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toTalk(row: TalkSubmissionRow): TalkDetail {
  return {
    bio: row.bio ?? null,
    city: row.city ?? null,
    contentLocked: Boolean(row.contentLocked),
    createdAt: row.createdAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    description: row.description ?? null,
    email: row.email,
    id: row.id,
    name: row.name,
    slidesFileName: row.slidesFileName ?? null,
    slidesLocked: Boolean(row.slidesLocked),
    slidesMimeType: row.slidesMimeType ?? null,
    slidesSize: row.slidesSize ?? null,
    slidesUrl: row.slidesUrl ?? null,
    status: row.status,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId ?? null,
  };
}

function toSpeaker(row: SpeakerRow): SpeakerDetail {
  return {
    bio: row.bio ?? null,
    company: row.company ?? null,
    companyLogoUrl: row.companyLogoUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    eventId: row.eventId ?? "",
    headshotUrl: row.imageUrl ?? null,
    id: row.id,
    linkedinUrl: row.linkedinUrl ?? null,
    name: row.name,
    order: row.sortOrder,
    submissionId: row.submissionId ?? null,
    talkDescription: row.talkDescription ?? null,
    talkDescriptionShort: row.talkDescriptionShort ?? null,
    talkTitle: row.talkTitle ?? null,
    title: row.title ?? null,
    twitterHandle: row.twitterHandle ?? null,
    updatedAt: row.updatedAt.toISOString(),
    websiteUrl: row.websiteUrl ?? null,
  };
}

function patchSet(patch: Record<string, unknown>): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      set[key] = value;
    }
  }
  return set;
}

export async function eventExists(store: TenantStore, eventId: string): Promise<boolean> {
  const { events } = store.tables;
  const rows = await store.db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, store.orgId), eq(events.id, eventId)))
    .limit(1);
  return Boolean(first(rows));
}

export async function insertTalk(
  store: TenantStore,
  input: TalkSubmissionInput & { email: string; name: string; title: string; userId: string },
): Promise<Result<{ talk: TalkDetail }>> {
  const { talkSubmissions } = store.tables;
  const now = new Date();
  const id = newId("talk");
  await store.db.insert(talkSubmissions).values({
    bio: input.bio ?? null,
    city: input.city ?? null,
    contentLocked: false,
    createdAt: now,
    deletedAt: null,
    description: input.description ?? null,
    email: input.email,
    id,
    name: input.name,
    orgId: store.orgId,
    slidesLocked: false,
    status: "pending",
    title: input.title,
    updatedAt: now,
    userId: input.userId,
  });
  return getTalkById(store, id);
}

export async function getTalkById(
  store: TenantStore,
  id: string,
): Promise<Result<{ talk: TalkDetail }>> {
  const { talkSubmissions } = store.tables;
  const rows = await store.db
    .select()
    .from(talkSubmissions)
    .where(and(eq(talkSubmissions.orgId, store.orgId), eq(talkSubmissions.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Talk submission not found");
  }
  return ok({ talk: toTalk(row) });
}

export async function listTalks(
  store: TenantStore,
  options: TalkListOptions = {},
): Promise<TalkDetail[]> {
  const { talkSubmissions } = store.tables;
  const filters = [eq(talkSubmissions.orgId, store.orgId)];
  if (options.status) {
    filters.push(eq(talkSubmissions.status, options.status));
  }
  if (!options.includeDeleted) {
    filters.push(isNull(talkSubmissions.deletedAt));
  }
  const rows = await store.db
    .select()
    .from(talkSubmissions)
    .where(and(...filters))
    .orderBy(desc(talkSubmissions.createdAt));
  return rows.map(toTalk);
}

export async function listTalksForUser(store: TenantStore, userId: string): Promise<TalkDetail[]> {
  const { talkSubmissions } = store.tables;
  const rows = await store.db
    .select()
    .from(talkSubmissions)
    .where(and(eq(talkSubmissions.orgId, store.orgId), eq(talkSubmissions.userId, userId)))
    .orderBy(desc(talkSubmissions.createdAt));
  return rows.map(toTalk);
}

export async function updateTalkById(
  store: TenantStore,
  id: string,
  patch: TalkPatch,
): Promise<Result<{ talk: TalkDetail }>> {
  const existing = await getTalkById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { deleted, ...rest } = patch;
  const { talkSubmissions } = store.tables;
  await store.db
    .update(talkSubmissions)
    .set(
      patchSet({
        ...rest,
        ...(deleted === undefined ? {} : { deletedAt: deleted ? new Date() : null }),
      }),
    )
    .where(and(eq(talkSubmissions.orgId, store.orgId), eq(talkSubmissions.id, id)));
  return getTalkById(store, id);
}

export async function deleteTalkById(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getTalkById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { talkSubmissions } = store.tables;
  await store.db
    .delete(talkSubmissions)
    .where(and(eq(talkSubmissions.orgId, store.orgId), eq(talkSubmissions.id, id)));
  return ok({ success: true });
}

export async function insertSpeaker(
  store: TenantStore,
  eventId: string,
  input: SpeakerInput & { name: string; submissionId?: string | null },
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const { speakers } = store.tables;
  const now = new Date();
  const id = newId("spk");
  await store.db.insert(speakers).values({
    bio: input.bio ?? null,
    company: input.company ?? null,
    companyLogoUrl: input.companyLogoUrl ?? null,
    createdAt: now,
    eventId,
    id,
    imageUrl: input.headshotUrl ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    name: input.name,
    orgId: store.orgId,
    sortOrder: await nextSpeakerOrder(store, eventId),
    submissionId: input.submissionId ?? null,
    talkDescription: input.talkDescription ?? null,
    talkDescriptionShort: input.talkDescriptionShort ?? null,
    talkTitle: input.talkTitle ?? null,
    title: input.title ?? null,
    twitterHandle: input.twitterHandle ?? null,
    updatedAt: now,
    websiteUrl: input.websiteUrl ?? null,
  });
  return getSpeakerById(store, id);
}

export async function getSpeakerById(
  store: TenantStore,
  id: string,
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const { speakers } = store.tables;
  const rows = await store.db
    .select()
    .from(speakers)
    .where(and(eq(speakers.orgId, store.orgId), eq(speakers.id, id)))
    .limit(1);
  const row = first(rows);
  if (!row) {
    return err("not_found", 404, "Speaker not found");
  }
  return ok({ speaker: toSpeaker(row) });
}

export async function listSpeakersForEvent(
  store: TenantStore,
  eventId: string,
): Promise<SpeakerDetail[]> {
  const { speakers } = store.tables;
  const rows = await store.db
    .select()
    .from(speakers)
    .where(and(eq(speakers.orgId, store.orgId), eq(speakers.eventId, eventId)))
    .orderBy(asc(speakers.sortOrder), asc(speakers.createdAt));
  return rows.map(toSpeaker);
}

export async function nextSpeakerOrder(store: TenantStore, eventId: string): Promise<number> {
  const { speakers } = store.tables;
  const rows = await store.db
    .select({ sortOrder: speakers.sortOrder })
    .from(speakers)
    .where(and(eq(speakers.orgId, store.orgId), eq(speakers.eventId, eventId)))
    .orderBy(desc(speakers.sortOrder))
    .limit(1);
  return (first(rows)?.sortOrder ?? -1) + 1;
}

export async function updateSpeakerById(
  store: TenantStore,
  id: string,
  patch: SpeakerInput & { sortOrder?: number },
): Promise<Result<{ speaker: SpeakerDetail }>> {
  const existing = await getSpeakerById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { speakers } = store.tables;
  const { headshotUrl, ...rest } = patch;
  await store.db
    .update(speakers)
    .set(
      patchSet({
        ...rest,
        ...(headshotUrl === undefined ? {} : { imageUrl: headshotUrl }),
      }),
    )
    .where(and(eq(speakers.orgId, store.orgId), eq(speakers.id, id)));
  return getSpeakerById(store, id);
}

export async function deleteSpeakerById(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getSpeakerById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { speakers } = store.tables;
  await store.db.delete(speakers).where(and(eq(speakers.orgId, store.orgId), eq(speakers.id, id)));
  return ok({ success: true });
}

function toComment(row: {
  authorId: string;
  content: string;
  createdAt: Date;
  id: string;
  submissionId: string;
  updatedAt: Date;
}): TalkComment {
  return {
    authorId: row.authorId,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    submissionId: row.submissionId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTalkComments(
  store: TenantStore,
  submissionId: string,
): Promise<TalkComment[]> {
  const { talkComments } = store.tables;
  const rows = await store.db
    .select()
    .from(talkComments)
    .where(and(eq(talkComments.orgId, store.orgId), eq(talkComments.submissionId, submissionId)))
    .orderBy(asc(talkComments.createdAt));
  return rows.map(toComment);
}

export async function insertTalkComment(
  store: TenantStore,
  input: { authorId: string; content: string; submissionId: string },
): Promise<TalkComment> {
  const { talkComments } = store.tables;
  const now = new Date();
  const id = newId("tcm");
  await store.db.insert(talkComments).values({
    authorId: input.authorId,
    content: input.content,
    createdAt: now,
    id,
    orgId: store.orgId,
    submissionId: input.submissionId,
    updatedAt: now,
  });
  return {
    authorId: input.authorId,
    content: input.content,
    createdAt: now.toISOString(),
    id,
    submissionId: input.submissionId,
    updatedAt: now.toISOString(),
  };
}

export async function getTalkCommentById(
  store: TenantStore,
  id: string,
): Promise<Result<{ comment: TalkComment }>> {
  const { talkComments } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(talkComments)
      .where(and(eq(talkComments.orgId, store.orgId), eq(talkComments.id, id)))
      .limit(1),
  );
  if (!row) {
    return err("not_found", 404, "Comment not found");
  }
  return ok({ comment: toComment(row) });
}

export async function deleteTalkCommentById(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const existing = await getTalkCommentById(store, id);
  if (!existing.ok) {
    return existing;
  }
  const { talkComments } = store.tables;
  await store.db
    .delete(talkComments)
    .where(and(eq(talkComments.orgId, store.orgId), eq(talkComments.id, id)));
  return ok({ success: true });
}
