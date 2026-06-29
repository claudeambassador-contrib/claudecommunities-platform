import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createSpeakerFromSubmission } from "@/lib/services/speakers";

export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "speakers:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json()) as { submissionId?: string };
    if (!body.submissionId || typeof body.submissionId !== "string") {
      return NextResponse.json({ error: "submissionId required" }, { status: 400 });
    }
    return NextResponse.json(await createSpeakerFromSubmission(user, id, body.submissionId));
  },
);
