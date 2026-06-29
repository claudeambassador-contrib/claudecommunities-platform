import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { getEmailPreferences, updateEmailPreferences } from "@/lib/services/users";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await getEmailPreferences(user));
});

export const PUT = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const body = await request.json();
  return NextResponse.json(await updateEmailPreferences(user, body));
});
