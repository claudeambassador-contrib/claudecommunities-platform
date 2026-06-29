import { NextResponse } from "next/server";
import { ensurePermission, requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deletePost, setPostPin } from "@/lib/services/posts";

type RouteCtx = { params: Promise<{ id: string }> };

export const DELETE = withService(async (_request: Request, { params }: RouteCtx) => {
  const user = await requireSessionUser();
  ensurePermission(user, "posts.delete");
  const { id } = await params;
  await deletePost(user, id);
  return NextResponse.json({ success: true });
});

export const PUT = withService(async (request: Request, { params }: RouteCtx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = await request.json();
  const result = await setPostPin(user, id, Boolean(body.isPinned));
  return NextResponse.json({ id: result.id, success: true });
});
