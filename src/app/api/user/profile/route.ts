import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { updateProfile } from "@/lib/services/users";

export const PUT = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const body = await request.json();
  return NextResponse.json({ user: await updateProfile(user, body) });
});
