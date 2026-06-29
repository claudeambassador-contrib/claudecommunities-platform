import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { searchUsers } from "@/lib/services/users";

export const GET = withService(async (request: Request) => {
  await requireSessionUser();
  const q = new URL(request.url).searchParams.get("q") || "";
  return NextResponse.json(await searchUsers(q));
});
