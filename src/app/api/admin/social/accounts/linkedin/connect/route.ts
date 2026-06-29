import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { startConnect } from "@/lib/services/socialAccounts";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  const { url } = await startConnect(user, "linkedin");
  return NextResponse.redirect(url, { status: 302 });
});
