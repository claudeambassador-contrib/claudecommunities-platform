import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { disconnectAccount } from "@/lib/services/socialAccounts";

export const DELETE = withService(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSessionUser();
  const { id } = await ctx.params;
  return NextResponse.json(await disconnectAccount(user, id));
});
