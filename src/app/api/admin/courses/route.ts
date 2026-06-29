import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { create, listAllAdmin } from "@/lib/services/courses";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await listAllAdmin(user));
});

export const POST = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const body = await request.json();
  return NextResponse.json(await create(user, body));
});
