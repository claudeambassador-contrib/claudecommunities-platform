import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createPreset, listPresets } from "@/lib/services/slideGenerator";

export const GET = withService(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(await listPresets(user));
});

export const POST = withService(async (request: Request) => {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "slide-gen:preset" });
  if (limited) return limited;
  const user = await requireSessionUser();
  const body = (await request.json()) as { name: string; data: unknown };
  return NextResponse.json(await createPreset(user, body.name, body.data));
});
