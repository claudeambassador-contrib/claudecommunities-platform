import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listCommentReactions, toggleCommentReaction } from "@/lib/services/reactions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withService<Ctx>(async (req, { params }) => {
  const user = await requireSessionUser();
  const { id: commentId } = await params;
  const { emoji } = (await req.json()) as { emoji?: string };
  await toggleCommentReaction(user, commentId, emoji as string);
  return NextResponse.json({ success: true });
});

export const GET = withService<Ctx>(async (_req, { params }) => {
  const user = await getCurrentUser();
  const { id: commentId } = await params;
  const reactions = await listCommentReactions(commentId, user?.id ?? null);
  return NextResponse.json({ reactions });
});
