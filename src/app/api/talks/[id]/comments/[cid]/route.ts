/**
 * Delete a single comment. Author + admin only.
 */
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteTalkComment } from "@/lib/services/talkComments";

type Ctx = { params: Promise<{ id: string; cid: string }> };

export const DELETE = withService(async (_request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { cid } = await params;
  await deleteTalkComment(user, cid);
  return NextResponse.json({ success: true });
});
