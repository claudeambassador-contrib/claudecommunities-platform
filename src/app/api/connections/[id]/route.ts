import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import {
  type ConnectionStatus,
  deleteConnectionById,
  respondToConnection,
} from "@/lib/services/connections";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withService<Ctx>(async (request, { params }) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const { status } = await request.json();
  return NextResponse.json(await respondToConnection(user, id, status as ConnectionStatus));
});

export const DELETE = withService<Ctx>(async (_request, { params }) => {
  const user = await requireSessionUser();
  const { id } = await params;
  return NextResponse.json(await deleteConnectionById(user, id));
});
