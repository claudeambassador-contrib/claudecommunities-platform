import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { ServiceError } from "@/lib/services/_errors";
import { withService } from "@/lib/services/_route";
import { listActivity, recordActivity } from "@/lib/services/activity";

export const GET = withService(async (request) => {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const userId = searchParams.get("userId") || undefined;
  return NextResponse.json(await listActivity(user, { limit, offset, userId }));
});

export const POST = withService(async (request) => {
  const user = await requireSessionUser();
  const { type, data } = await request.json();
  if (!type) throw new ServiceError("bad_request", "Activity type is required");
  await recordActivity({ userId: user.id, type, data });
  return NextResponse.json({ success: true });
});
