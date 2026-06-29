import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { reorderSpeakers } from "@/lib/services/speakers";

export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 120, windowMs: 60_000, key: "speakers:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json()) as { orderedIds?: string[] };
    if (!body.orderedIds || !Array.isArray(body.orderedIds)) {
      return NextResponse.json({ error: "orderedIds[] required" }, { status: 400 });
    }
    return NextResponse.json(await reorderSpeakers(user, id, body.orderedIds));
  },
);
