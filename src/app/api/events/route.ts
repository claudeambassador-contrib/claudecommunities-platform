import { NextResponse } from "next/server";

import { ensureUserInDb } from "@/lib/auth";
import { getActorPermissions, hasPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { createEvent, listEvents } from "@/lib/services/events";

export const GET = withService(async (request: Request) => {
  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  let includeInactive = false;
  if (wantsAll) {
    const user = await ensureUserInDb();
    if (user) {
      const { permissions: perms } = await getActorPermissions(user.id);
      if (hasPermission({ permissions: perms }, "events.view")) includeInactive = true;
    }
  }
  return NextResponse.json(await listEvents({ includeInactive }));
});

export const POST = withService(async (request: Request) => {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000, key: "events:write" });
  if (limited) return limited;

  const user = await requireSessionUser();
  const body = await request.json();
  return NextResponse.json(await createEvent(user, body));
});
