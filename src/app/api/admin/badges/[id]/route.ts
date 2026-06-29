import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { deleteBadge, getBadge, updateBadge } from "@/lib/services/badges";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withService<Ctx>(async (_request, { params }) => {
  await requireSessionUser();
  const { id } = await params;
  return NextResponse.json(await getBadge(id));
});

export const PUT = withService<Ctx>(async (request, { params }) => {
  const user = await requireSessionUser();
  const { id } = await params;
  const input = await request.json();
  return NextResponse.json(await updateBadge(user, id, input));
});

export const DELETE = withService<Ctx>(async (_request, { params }) => {
  const user = await requireSessionUser();
  const { id } = await params;
  return NextResponse.json(await deleteBadge(user, id));
});
