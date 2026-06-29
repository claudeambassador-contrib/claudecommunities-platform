import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { setRole } from "@/lib/services/users";

export const PATCH = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSessionUser();
    const { id } = await params;
    const { role } = await request.json();
    return NextResponse.json(await setRole(user, id, role));
  },
);
