/**
 * Admin comments thread on a talk submission. Same service-layer auth
 * (admins bypass the contentLocked check) — this route exists for the
 * admin UI's convenience so it doesn't have to also know the /api/talks
 * URL shape.
 */
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createTalkComment, listTalkComments } from "@/lib/services/talkComments";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withService(async (_request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const comments = await listTalkComments(user, id);
  return NextResponse.json({ comments });
});

export const POST = withService(async (request: Request, { params }: Ctx) => {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "talk-comment" });
  if (limited) return limited;

  const user = await requireSessionUser();
  const { id } = await params;
  const body = (await request.json()) as { content?: string };
  const comment = await createTalkComment(user, id, body.content ?? "");
  return NextResponse.json({ comment });
});
