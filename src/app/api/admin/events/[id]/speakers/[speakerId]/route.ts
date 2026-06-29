import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteSpeaker, type SpeakerInput, updateSpeaker } from "@/lib/services/speakers";

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ id: string; speakerId: string }> }) => {
    const limited = rateLimit(request, { limit: 120, windowMs: 60_000, key: "speakers:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { speakerId } = await params;
    const body = (await request.json()) as SpeakerInput;
    return NextResponse.json(await updateSpeaker(user, speakerId, body));
  },
);

export const DELETE = withService(
  async (request: Request, { params }: { params: Promise<{ id: string; speakerId: string }> }) => {
    const limited = rateLimit(request, { limit: 60, windowMs: 60_000, key: "speakers:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { speakerId } = await params;
    return NextResponse.json(await deleteSpeaker(user, speakerId));
  },
);
