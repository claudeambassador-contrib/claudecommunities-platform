/**
 * Comments thread on a TalkSubmission. Bi-directional: the submitting user
 * and admins both post here, e.g. an admin asking for clarification and
 * the speaker replying.
 *
 * Authorization:
 *  - Read: owner of the talk + any admin.
 *  - Create: same as read.
 *  - Delete: the comment's author, plus any admin.
 *
 * Posting is blocked when the talk's contentLocked flag is set, except for
 * admins (an admin must always be able to follow up post-event). This keeps
 * the lock semantics consistent with updateTalkContent in ./talks.ts.
 */
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import type { ActorLike } from "./_auth";
import { ServiceError } from "./_errors";

function isTalkAdmin(actor: ActorLike): boolean {
  return hasPermission(actor, "speakers.edit");
}

function serialize(c: {
  id: string;
  submissionId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author?: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  } | null;
}) {
  return {
    id: c.id,
    submissionId: c.submissionId,
    authorId: c.authorId,
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    author: c.author
      ? {
          id: c.author.id,
          name: c.author.name,
          image: c.author.image,
          role: c.author.role,
        }
      : null,
  };
}

export type SerializedTalkComment = ReturnType<typeof serialize>;

async function loadSubmissionOrThrow(submissionId: string) {
  const db = await getPrisma();
  const row = await db.talkSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, contentLocked: true },
  });
  if (!row) throw new ServiceError("not_found", "Talk submission not found");
  return row;
}

function ensureReadAccess(actor: ActorLike, ownerId: string | null) {
  if (isTalkAdmin(actor)) return;
  if (ownerId && ownerId === actor.id) return;
  throw new ServiceError("forbidden", "Not allowed");
}

export async function listTalkComments(actor: ActorLike, submissionId: string) {
  const db = await getPrisma();
  const submission = await loadSubmissionOrThrow(submissionId);
  ensureReadAccess(actor, submission.userId);

  const rows = await db.talkComment.findMany({
    where: { submissionId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
    },
  });
  return rows.map(serialize);
}

export async function createTalkComment(actor: ActorLike, submissionId: string, content: string) {
  const db = await getPrisma();
  const submission = await loadSubmissionOrThrow(submissionId);
  ensureReadAccess(actor, submission.userId);
  if (submission.contentLocked && !isTalkAdmin(actor)) {
    throw new ServiceError("forbidden", "This talk is locked — comments are read-only");
  }

  const trimmed = content?.trim() ?? "";
  if (!trimmed) throw new ServiceError("bad_request", "Comment cannot be empty");
  if (trimmed.length > 10_000) {
    throw new ServiceError("bad_request", "Comment is too long");
  }

  const created = await db.talkComment.create({
    data: { submissionId, authorId: actor.id, content: trimmed },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
    },
  });
  return serialize(created);
}

export async function deleteTalkComment(actor: ActorLike, commentId: string) {
  const db = await getPrisma();
  const row = await db.talkComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });
  if (!row) throw new ServiceError("not_found", "Comment not found");
  if (!isTalkAdmin(actor) && row.authorId !== actor.id) {
    throw new ServiceError("forbidden", "Not allowed");
  }
  await db.talkComment.delete({ where: { id: commentId } });
  return { success: true };
}
