import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import {
  provisionClaudienceForEvent,
  updateClaudienceNotificationEmail,
} from "@/lib/services/claudience";

export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 10, windowMs: 60_000, key: "claudience:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      notificationEmail?: string | null;
    } | null;
    return NextResponse.json(
      await provisionClaudienceForEvent(user, id, {
        notificationEmail: body?.notificationEmail ?? null,
      }),
    );
  },
);

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "claudience:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      notificationEmail?: string | null;
    } | null;
    if (!body || !("notificationEmail" in body)) {
      return NextResponse.json({ error: "notificationEmail required" }, { status: 400 });
    }
    return NextResponse.json(
      await updateClaudienceNotificationEmail(user, id, body.notificationEmail ?? null),
    );
  },
);
