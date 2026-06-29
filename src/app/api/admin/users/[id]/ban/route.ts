import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { setBanned } from "@/lib/services/users";

export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await setBanned(user, id, true, body.reason));
  },
);
