/**
 * Slides metadata on a talk. The actual upload happens via /api/upload —
 * the client uploads the file to R2 first, then POSTs the resulting URL
 * (plus filename/mime/size) here to attach it. DELETE clears the fields.
 */
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { clearTalkSlides, type SlidesInput, setTalkSlides } from "@/lib/services/talks";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withService(async (request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const body = (await request.json()) as Partial<SlidesInput>;
  if (!body.slidesUrl) {
    return NextResponse.json({ error: "slidesUrl required" }, { status: 400 });
  }
  const talk = await setTalkSlides(user, id, {
    slidesUrl: body.slidesUrl,
    slidesFileName: body.slidesFileName ?? null,
    slidesMimeType: body.slidesMimeType ?? null,
    slidesSize: body.slidesSize ?? null,
  });
  return NextResponse.json({ talk });
});

export const DELETE = withService(async (_request: Request, { params }: Ctx) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const talk = await clearTalkSlides(user, id);
  return NextResponse.json({ talk });
});
