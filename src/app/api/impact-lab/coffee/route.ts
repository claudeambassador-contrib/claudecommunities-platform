import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { ServiceError } from "@/lib/services/_errors";
import { withService } from "@/lib/services/_route";
import { getParticipantFromSession, redeemCoffee } from "@/lib/services/impactLab";

export const POST = withService(async (request) => {
  const limited = rateLimit(request, { limit: 20, windowMs: 60_000, key: "impactlab:coffee" });
  if (limited) return limited;

  const participant = await getParticipantFromSession();
  if (!participant) throw new ServiceError("unauthenticated", "Not signed in");

  const result = await redeemCoffee(participant);
  return NextResponse.json({ ok: true, ...result });
});
