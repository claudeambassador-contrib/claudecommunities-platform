import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listLumaInterestsForUser } from "@/lib/services/eventLumaInterest";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await listLumaInterestsForUser(user));
});
