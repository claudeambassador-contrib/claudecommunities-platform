import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createRole, listRoles } from "@/lib/services/roles";

export const GET = withService(async () => {
  const actor = await requireSessionUser();
  return NextResponse.json(await listRoles(actor));
});

export const POST = withService(async (request: Request) => {
  const actor = await requireSessionUser();
  const body = await request.json();
  return NextResponse.json(await createRole(actor, body));
});
