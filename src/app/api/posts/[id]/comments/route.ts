import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createComment, listForPost } from "@/lib/services/comments";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withService(async (_request: Request, { params }: RouteCtx) => {
  const { id: postId } = await params;
  const tree = await listForPost(postId);
  return NextResponse.json(tree);
});

export const POST = withService(async (request: Request, { params }: RouteCtx) => {
  const user = await requireSessionUser();
  const { id: postId } = await params;
  const body = await request.json();
  const comment = await createComment(user, {
    postId,
    content: body.content,
    parentId: body.parentId,
  });
  return NextResponse.json(comment);
});
