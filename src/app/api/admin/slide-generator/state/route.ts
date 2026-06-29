import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { getState, putState } from "@/lib/services/slideGenerator";

export const GET = withService(async (request: Request) => {
  const user = await requireSessionUser();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "";
  return NextResponse.json(await getState(user, scope));
});

export const PUT = withService(async (request: Request) => {
  const limited = rateLimit(request, { limit: 60, windowMs: 60_000, key: "slide-gen:state" });
  if (limited) return limited;
  const user = await requireSessionUser();
  const body = (await request.json()) as { scope: string; data: unknown };
  return NextResponse.json(await putState(user, body.scope, body.data));
});
