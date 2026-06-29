import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { getOnlineUserIds, updateLastSeen } from "@/lib/services/users";

export const POST = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await updateLastSeen(user));
});

export const GET = withService(async () => {
  await requireSessionUser();
  return NextResponse.json({ onlineUserIds: await getOnlineUserIds() });
});
