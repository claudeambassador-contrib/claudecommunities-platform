import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createPost, type ListOptions, listPosts } from "@/lib/services/socialPosts";
import type { SocialPlatform, SocialPostStatus } from "@/lib/social/types";

export const GET = withService(async (req) => {
  const user = await requireSessionUser();
  const url = new URL(req.url);
  const options: ListOptions = {};
  const range = url.searchParams.get("range");
  if (range === "past" || range === "upcoming" || range === "all") {
    options.range = range;
  }
  const status = url.searchParams.get("status");
  if (status) options.status = status.split(",") as SocialPostStatus[];
  const platform = url.searchParams.get("platform");
  if (platform) options.platform = platform as SocialPlatform;
  const accountId = url.searchParams.get("accountId");
  if (accountId) options.accountId = accountId;
  const limit = url.searchParams.get("limit");
  if (limit) options.limit = Number(limit);
  return NextResponse.json(await listPosts(user, options));
});

export const POST = withService(async (req) => {
  const user = await requireSessionUser();
  const body = await req.json();
  return NextResponse.json(await createPost(user, body));
});
