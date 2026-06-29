import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import {
  getLumaInterestStatus,
  registerLumaInterest,
  unregisterLumaInterest,
} from "@/lib/services/eventLumaInterest";

export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: eventId } = await params;
    const viewer = await getCurrentUser();
    return NextResponse.json(await getLumaInterestStatus(eventId, viewer));
  },
);

export const POST = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id: eventId } = await params;
    return NextResponse.json(await registerLumaInterest(user, eventId));
  },
);

export const DELETE = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id: eventId } = await params;
    return NextResponse.json(await unregisterLumaInterest(user, eventId));
  },
);
