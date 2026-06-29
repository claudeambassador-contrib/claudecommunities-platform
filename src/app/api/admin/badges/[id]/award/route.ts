import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { awardBadge, revokeBadge } from "@/lib/services/badges";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withService<Ctx>(async (request, { params }) => {
  const user = await requireSessionUser();
  const { id: badgeId } = await params;
  const { userId } = await request.json();
  return NextResponse.json(await awardBadge(user, badgeId, userId));
});

export const DELETE = withService<Ctx>(async (request, { params }) => {
  const user = await requireSessionUser();
  const { id: badgeId } = await params;
  const { userId } = await request.json();
  return NextResponse.json(await revokeBadge(user, badgeId, userId));
});
