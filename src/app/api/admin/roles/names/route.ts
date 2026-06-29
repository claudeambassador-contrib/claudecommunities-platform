import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listRolesForAssignment } from "@/lib/services/roles";

export const GET = withService(async () => {
  const actor = await requireSessionUser();
  return NextResponse.json(await listRolesForAssignment(actor));
});
