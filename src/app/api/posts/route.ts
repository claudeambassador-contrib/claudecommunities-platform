import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createPost, listFeed } from "@/lib/services/posts";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const posts = await listFeed({
      spaceSlug: searchParams.get("space"),
      limit: parseInt(searchParams.get("limit") || "20", 10),
      offset: parseInt(searchParams.get("offset") || "0", 10),
      actor: currentUser,
    });
    return NextResponse.json(posts);
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export const POST = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const body = await request.json();
  const result = await createPost(user, {
    content: body.content,
    spaceId: body.spaceId,
    title: body.title,
    mediaUrl: body.mediaUrl,
    mediaType: body.mediaType,
    mentionedUserIds: body.mentionedUserIds,
    poll: body.poll,
    attachments: body.attachments,
  });
  return NextResponse.json({ id: result.id, success: true });
});
