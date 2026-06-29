/**
 * Public endpoint that powers the /speak form. Renamed concept: this now
 * creates a TalkSubmission. The URL is kept at /api/speakers for backwards
 * compatibility with any out-of-tree callers and to avoid churn on the
 * /speak page until the user portal lands.
 *
 * Accepts both the new field names (`title`, `description`) and the legacy
 * `topic` shape (mapped to `title`) so older clients keep working.
 */
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createTalkSubmission, type TalkSubmissionInput } from "@/lib/services/talks";

interface SubmitBody extends TalkSubmissionInput {
  /** Legacy field — the old form posted `topic`. We map it to `title`. */
  topic?: string | null;
}

export const POST = withService(async (request: Request) => {
  const limited = rateLimit(request, { limit: 5, windowMs: 60_000, key: "talk-submission" });
  if (limited) return limited;

  const user = await requireSessionUser();
  const body = (await request.json()) as SubmitBody;
  const input: TalkSubmissionInput = {
    name: body.name,
    email: body.email,
    title: body.title ?? body.topic ?? null,
    description: body.description,
    bio: body.bio,
    city: body.city,
  };
  const submission = await createTalkSubmission(user, input);
  return NextResponse.json({ success: true, id: submission.id });
});
