import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { withService } from "@/lib/services/_route";
import {
  getParticipantFromSession,
  getPeoplesChoiceState,
  recordPeoplesChoiceVote,
} from "@/lib/services/impactLab";

// People's Choice voting endpoint. Separate from the morning's problem-
// statement vote — participants vote for their favourite team's app.

const Input = z.object({ teamId: z.string().min(1).max(64) });

export const GET = withService(async () => {
  return NextResponse.json(await getPeoplesChoiceState());
});

export const POST = withService(async (request) => {
  const limited = rateLimit(request, {
    limit: 60,
    windowMs: 60_000,
    key: "impactlab:peoples-choice",
  });
  if (limited) return limited;

  const participant = await getParticipantFromSession();
  if (!participant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a team to vote for." }, { status: 400 });
  }

  const result = await recordPeoplesChoiceVote({ participant, teamId: parsed.data.teamId });
  return NextResponse.json({ ok: true, ...result });
});
