import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { isPostLikedByUser, togglePostLike } from "@/lib/services/likes";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withService<Ctx>(async (_req, { params }) => {
  const user = await requireSessionUser();
  const { id: postId } = await params;
  return NextResponse.json(await togglePostLike(user, postId));
});

export const GET = withService<Ctx>(async (_req, { params }) => {
  const user = await getCurrentUser();
  const { id: postId } = await params;
  const liked = user ? await isPostLikedByUser(user.id, postId) : false;
  return NextResponse.json({ liked });
});
