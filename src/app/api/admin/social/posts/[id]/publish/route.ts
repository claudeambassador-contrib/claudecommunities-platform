import { NextResponse } from "next/server";
import { ensurePermission, requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { publishExisting } from "@/lib/services/socialPosts";

export const POST = withService(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSessionUser();
  ensurePermission(user, "social.publish");
  const { id } = await ctx.params;
  return NextResponse.json(await publishExisting(id));
});
