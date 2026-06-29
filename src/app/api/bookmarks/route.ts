import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listBookmarkedFeed } from "@/lib/services/posts";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  const posts = await listBookmarkedFeed(user);
  return NextResponse.json(posts);
});
