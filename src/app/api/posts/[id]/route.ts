import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deletePost, getPost, setPostPin, updatePost } from "@/lib/services/posts";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withService(async (_request: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const post = await getPost(id, currentUser);
  return NextResponse.json(post);
});

export const PUT = withService(async (request: Request, { params }: RouteCtx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = await request.json();

  // Pin toggle path (admin only — enforced inside service).
  if (typeof body.isPinned === "boolean") {
    const result = await setPostPin(user, id, body.isPinned);
    return NextResponse.json({ id: result.id, success: true, isPinned: result.isPinned });
  }

  // NOTE: spaceId from the body is intentionally NOT forwarded for non-admins
  // (mass-assignment defence — see prior inline comment). The service also
  // gates admin-only space moves, but we omit it here to make the route's
  // intent explicit.
  const result = await updatePost(user, id, {
    title: body.title,
    content: body.content,
    mediaUrl: body.mediaUrl,
    mediaType: body.mediaType,
  });
  return NextResponse.json({
    id: result.id,
    success: true,
    mediaUrl: result.mediaUrl,
    mediaType: result.mediaType,
  });
});

export const DELETE = withService(async (_request: Request, { params }: RouteCtx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  await deletePost(user, id);
  return NextResponse.json({ success: true });
});
