import { NextResponse } from "next/server";

import { withService } from "@/lib/services/_route";
import { getProfile } from "@/lib/services/users";

export const GET = withService(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return NextResponse.json(await getProfile(id));
  },
);
