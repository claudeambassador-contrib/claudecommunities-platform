import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { create, listPublished } from "@/lib/services/scheduled-courses";

export const GET = withService(async () => {
  return NextResponse.json(await listPublished());
});

export const POST = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const body = await request.json();
  return NextResponse.json(await create(user, body));
});
