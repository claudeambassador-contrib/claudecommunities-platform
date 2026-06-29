import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { markSpaceViewed, unreadCounts } from "@/lib/services/spaces";

// GET - Get unread post counts per space for current user
export const GET = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await unreadCounts(user));
});

// POST - Mark a space as viewed
export const POST = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const { spaceId } = await request.json();
  return NextResponse.json(await markSpaceViewed(user, spaceId));
});
