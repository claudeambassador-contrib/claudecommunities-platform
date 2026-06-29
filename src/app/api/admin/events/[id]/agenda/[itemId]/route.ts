import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteAgendaItem, updateAgendaItem } from "@/lib/services/eventAgenda";

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
    const limited = rateLimit(request, { limit: 120, windowMs: 60_000, key: "agenda:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { itemId } = await params;
    const body = await request.json();
    return NextResponse.json(await updateAgendaItem(user, itemId, body));
  },
);

export const DELETE = withService(
  async (request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
    const limited = rateLimit(request, { limit: 60, windowMs: 60_000, key: "agenda:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { itemId } = await params;
    return NextResponse.json(await deleteAgendaItem(user, itemId));
  },
);
