import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { isPostBookmarkedByUser, togglePostBookmark } from "@/lib/services/bookmarks";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withService<Ctx>(async (_req, { params }) => {
  const user = await getCurrentUser();
  const { id: postId } = await params;
  const isBookmarked = user ? await isPostBookmarkedByUser(user.id, postId) : false;
  return NextResponse.json({ isBookmarked });
});

export const POST = withService<Ctx>(async (_req, { params }) => {
  const user = await requireSessionUser();
  const { id: postId } = await params;
  return NextResponse.json(await togglePostBookmark(user, postId));
});
