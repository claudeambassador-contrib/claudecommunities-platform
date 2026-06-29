import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listNotifications, markAllRead } from "@/lib/services/notifications";

export const GET = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const unreadOnly = searchParams.get("unread") === "true";
  const result = await listNotifications(user, { limit, unreadOnly });
  return NextResponse.json(result);
});

// Mark all as read
export const PATCH = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await markAllRead(user));
});
