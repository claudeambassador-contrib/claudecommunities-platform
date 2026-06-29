import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listMembers, type MemberTab } from "@/lib/services/users";

const PAGE_SIZE = 24;
const VALID_TABS: MemberTab[] = ["all", "near-me", "online", "recent", "connections"];

export const GET = withService(async (request) => {
  const user = await requireSessionUser();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || undefined;
  const tabParam = searchParams.get("tab");
  const tab = VALID_TABS.includes(tabParam as MemberTab) ? (tabParam as MemberTab) : "all";
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const result = await listMembers({
    currentUserId: user.id,
    search,
    tab,
    limit: PAGE_SIZE,
    offset,
  });

  return NextResponse.json(result);
});
