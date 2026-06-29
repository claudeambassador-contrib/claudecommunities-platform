import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getSpeaker } from "@/lib/services/speakers";
import { generateTalkShortDescription } from "@/lib/services/talkShortDescriptionGenerator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; speakerId: string }> },
) {
  const limited = rateLimit(request, { limit: 20, windowMs: 60_000, key: "speakers:ai" });
  if (limited) return limited;

  const auth = await requirePermissionResponse("events.edit");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id, speakerId } = await params;

  let focus: string | null = null;
  try {
    const body = (await request.json().catch(() => null)) as { focus?: string } | null;
    if (body?.focus && typeof body.focus === "string") focus = body.focus;
  } catch {
    // ignore — empty body is allowed
  }

  const speaker = await getSpeaker(user, speakerId);
  if (!speaker) return NextResponse.json({ error: "Speaker not found" }, { status: 404 });
  if (speaker.eventId !== id)
    return NextResponse.json({ error: "Speaker does not belong to this event" }, { status: 400 });

  if (!speaker.talkDescription?.trim()) {
    return NextResponse.json(
      { error: "Speaker has no talk description to summarise" },
      { status: 400 },
    );
  }

  try {
    const { shortDescription } = await generateTalkShortDescription({
      speakerName: speaker.name,
      talkTitle: speaker.talkTitle,
      talkDescription: speaker.talkDescription,
      company: speaker.company,
      focus,
    });
    return NextResponse.json({ shortDescription });
  } catch (error) {
    console.error("Short description generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
