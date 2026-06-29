import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { voteOnPoll } from "@/lib/services/polls";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withService<Ctx>(async (request, { params }) => {
  const user = await requireSessionUser();
  const { id: pollId } = await params;
  const { optionId } = await request.json();
  return NextResponse.json(await voteOnPoll(user, pollId, optionId));
});
