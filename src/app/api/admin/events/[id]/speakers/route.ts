import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createSpeaker, listSpeakers, type SpeakerInput } from "@/lib/services/speakers";

export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    return NextResponse.json(await listSpeakers(user, id));
  },
);

export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 60, windowMs: 60_000, key: "speakers:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json()) as SpeakerInput;
    return NextResponse.json(await createSpeaker(user, id, body));
  },
);
