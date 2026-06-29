/**
 * Admin list of all talk submissions. Wraps listTalkSubmissions so the
 * service can be the single source of truth for serialization + filtering.
 */
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { listTalkSubmissions, type TalkSubmissionStatus } from "@/lib/services/talks";

const VALID_STATUS = new Set<TalkSubmissionStatus>(["pending", "approved", "declined"]);

export const GET = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const status =
    rawStatus && VALID_STATUS.has(rawStatus as TalkSubmissionStatus)
      ? (rawStatus as TalkSubmissionStatus)
      : undefined;
  // The admin overview opts in with `?includeDeleted=true` so it can render
  // its own "Deleted" tab (splitting active vs deleted client-side). Default
  // stays exclude-deleted to match the service default.
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const submissions = await listTalkSubmissions(user, {
    ...(status ? { status } : {}),
    includeDeleted,
  });
  return NextResponse.json({ submissions });
});
