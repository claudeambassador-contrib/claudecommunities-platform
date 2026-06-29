import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deletePreset, getPreset, updatePreset } from "@/lib/services/slideGenerator";

export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    return NextResponse.json(await getPreset(user, id));
  },
);

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 30, windowMs: 60_000, key: "slide-gen:preset" });
    if (limited) return limited;
    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json()) as { name?: string; data?: unknown };
    return NextResponse.json(await updatePreset(user, id, body));
  },
);

export const DELETE = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    return NextResponse.json(await deletePreset(user, id));
  },
);
