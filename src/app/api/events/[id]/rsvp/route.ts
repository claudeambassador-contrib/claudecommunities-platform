import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteRsvp, getRsvpStats, rsvpToEvent } from "@/lib/services/events";

// GET - Get RSVPs for an event (public; viewer info optional)
export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: eventId } = await params;
    const viewer = await getCurrentUser();
    return NextResponse.json(await getRsvpStats(eventId, viewer));
  },
);

// POST - Create or update RSVP
export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id: eventId } = await params;
    const { status } = await request.json();
    return NextResponse.json(await rsvpToEvent(user, eventId, status));
  },
);

// DELETE - Remove RSVP
export const DELETE = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id: eventId } = await params;
    return NextResponse.json(await deleteRsvp(user, eventId));
  },
);
