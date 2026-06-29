import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listPostReactions, togglePostReaction } from "@/lib/services/reactions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withService<Ctx>(async (req, { params }) => {
  const user = await requireSessionUser();
  const { id: postId } = await params;
  const { emoji } = (await req.json()) as { emoji?: string };
  await togglePostReaction(user, postId, emoji as string);
  return NextResponse.json({ success: true });
});

export const GET = withService<Ctx>(async (_req, { params }) => {
  const user = await getCurrentUser();
  const { id: postId } = await params;
  const reactions = await listPostReactions(postId, user?.id ?? null);
  return NextResponse.json({ reactions });
});
