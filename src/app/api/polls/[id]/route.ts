import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withService } from "@/lib/services/_route";
import { getPoll } from "@/lib/services/polls";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withService<Ctx>(async (_request, { params }) => {
  const user = await getCurrentUser();
  const { id } = await params;
  return NextResponse.json(await getPoll(id, user));
});
