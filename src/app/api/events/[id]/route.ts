import { NextResponse } from "next/server";
import { ensureUserInDb } from "@/lib/auth";
import { getActorPermissions, hasPermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteEvent, getEvent, setEventActive, updateEvent } from "@/lib/services/events";

export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await ensureUserInDb();
    let includeInactive = false;
    if (user) {
      const { permissions: perms } = await getActorPermissions(user.id);
      includeInactive = hasPermission({ permissions: perms }, "events.view");
    }
    return NextResponse.json(await getEvent(id, { includeInactive }));
  },
);

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 60, windowMs: 60_000, key: "events:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json()) as { isActive?: boolean };
    if (typeof body?.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive (boolean) required" }, { status: 400 });
    }
    return NextResponse.json(await setEventActive(user, id, body.isActive));
  },
);

export const PUT = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "events:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await updateEvent(user, id, body));
  },
);

export const DELETE = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "events:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    return NextResponse.json(await deleteEvent(user, id));
  },
);
