import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteRole, updateRole } from "@/lib/services/roles";

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ name: string }> }) => {
    const actor = await requireSessionUser();
    const { name } = await params;
    const body = await request.json();
    return NextResponse.json(await updateRole(actor, name, body));
  },
);

export const DELETE = withService(
  async (_request: Request, { params }: { params: Promise<{ name: string }> }) => {
    const actor = await requireSessionUser();
    const { name } = await params;
    return NextResponse.json(await deleteRole(actor, name));
  },
);
