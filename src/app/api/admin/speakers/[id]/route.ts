/**
 * Admin operations on a single talk submission:
 *  - PATCH: status, contentLocked, slidesLocked, plus full content edit
 *    (title, description, bio, name, email, city). Admin bypasses both
 *    lock flags.
 *  - DELETE: admin-only hard delete.
 */
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import {
  deleteTalkSubmission,
  getTalk,
  setTalkDeleted,
  setTalkLocks,
  setTalkStatus,
  type TalkSubmissionInput,
  type TalkSubmissionStatus,
  updateTalkContent,
} from "@/lib/services/talks";

type Ctx = { params: Promise<{ id: string }> };

interface AdminPatchBody extends TalkSubmissionInput {
  status?: TalkSubmissionStatus;
  contentLocked?: boolean;
  slidesLocked?: boolean;
  /** Soft-delete (true) or restore (false) — moves the row to/from the Deleted tab. */
  deleted?: boolean;
}

export const PATCH = withService(async (request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = (await request.json()) as AdminPatchBody;

  // Apply each set of changes through its dedicated service entry so the
  // service's own validation runs. Locks come last so a content edit that
  // races a lock toggle still respects the final state.
  let result: Awaited<ReturnType<typeof updateTalkContent>> | null = null;

  const contentInput: TalkSubmissionInput = {
    name: body.name,
    email: body.email,
    title: body.title,
    description: body.description,
    bio: body.bio,
    city: body.city,
  };
  const hasContent = Object.values(contentInput).some((v) => v !== undefined);
  if (hasContent) {
    result = await updateTalkContent(user, id, contentInput);
  }
  if (body.status !== undefined) {
    result = await setTalkStatus(user, id, body.status);
  }
  if (body.contentLocked !== undefined || body.slidesLocked !== undefined) {
    result = await setTalkLocks(user, id, {
      contentLocked: body.contentLocked,
      slidesLocked: body.slidesLocked,
    });
  }
  if (body.deleted !== undefined) {
    result = await setTalkDeleted(user, id, body.deleted);
  }

  // Caller may have sent an empty body — return current state instead of null.
  if (!result) result = await getTalk(user, id);
  return NextResponse.json({ submission: result });
});

export const DELETE = withService(async (_request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  await deleteTalkSubmission(user, id);
  return NextResponse.json({ success: true });
});
