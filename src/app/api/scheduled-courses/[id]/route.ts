import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { getById, remove, update } from "@/lib/services/scheduled-courses";

export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return NextResponse.json(await getById(id));
  },
);

export const PUT = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await update(user, id, body));
  },
);

export const DELETE = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    return NextResponse.json(await remove(user, id));
  },
);
