/**
 * User-facing talks API. GET returns the signed-in user's submissions;
 * POST creates a new one. Admin queries (all submissions) live under
 * /api/admin/speakers for backwards compatibility.
 */
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import {
  createTalkSubmission,
  listUserTalks,
  type TalkSubmissionInput,
} from "@/lib/services/talks";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  const talks = await listUserTalks(user);
  return NextResponse.json({ talks });
});

export const POST = withService(async (request: Request) => {
  const limited = rateLimit(request, { limit: 5, windowMs: 60_000, key: "talk-submission" });
  if (limited) return limited;

  const user = await requireSessionUser();
  const body = (await request.json()) as TalkSubmissionInput;
  const talk = await createTalkSubmission(user, body);
  return NextResponse.json({ talk });
});
