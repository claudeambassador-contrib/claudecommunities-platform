import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createBadge, listBadges } from "@/lib/services/badges";

export const GET = withService(async () => {
  await requireSessionUser();
  return NextResponse.json(await listBadges());
});

export const POST = withService(async (request) => {
  const user = await requireSessionUser();
  const input = await request.json();
  return NextResponse.json(await createBadge(user, input));
});
