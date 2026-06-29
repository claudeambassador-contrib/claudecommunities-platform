import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { ServiceError } from "@/lib/services/_errors";
import { withService } from "@/lib/services/_route";
import { castVote, getParticipantFromSession } from "@/lib/services/impactLab";

const Input = z.object({ statementId: z.string().min(1).max(64) });

export const POST = withService(async (request) => {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "impactlab:vote" });
  if (limited) return limited;

  const participant = await getParticipantFromSession();
  if (!participant) throw new ServiceError("unauthenticated", "Not signed in");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await castVote(participant, parsed.data.statementId);
  return NextResponse.json({ ok: true, ...result });
});
