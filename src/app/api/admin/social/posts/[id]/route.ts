import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deletePost, getPost, updatePost } from "@/lib/services/socialPosts";

export const GET = withService(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSessionUser();
  const { id } = await ctx.params;
  return NextResponse.json(await getPost(user, id));
});

export const PATCH = withService(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSessionUser();
  const { id } = await ctx.params;
  const body = await req.json();
  return NextResponse.json(await updatePost(user, id, body));
});

export const DELETE = withService(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSessionUser();
  const { id } = await ctx.params;
  return NextResponse.json(await deletePost(user, id));
});
