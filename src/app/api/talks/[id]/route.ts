/**
 * Single-talk operations for the owning user (or admin). Reads, content
 * updates, and ownership-aware delete. Lock checks live in the service.
 */
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import {
  deleteTalkSubmission,
  getTalk,
  type TalkSubmissionInput,
  updateTalkContent,
} from "@/lib/services/talks";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withService(async (_request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const talk = await getTalk(user, id);
  return NextResponse.json({ talk });
});

export const PATCH = withService(async (request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = (await request.json()) as TalkSubmissionInput;
  const talk = await updateTalkContent(user, id, body);
  return NextResponse.json({ talk });
});

export const DELETE = withService(async (_request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  await deleteTalkSubmission(user, id);
  return NextResponse.json({ success: true });
});
