import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { type ReorderEntry, reorderAgenda } from "@/lib/services/eventAgenda";

export const POST = withService(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const limited = rateLimit(request, { limit: 120, windowMs: 60_000, key: "agenda:write" });
    if (limited) return limited;

    const user = await requireSessionUser();
    const { id } = await params;
    const body = (await request.json()) as {
      orderedIds?: string[];
      entries?: ReorderEntry[];
    };
    const entries: ReorderEntry[] | undefined =
      body.entries ?? body.orderedIds?.map((eid) => ({ id: eid }));
    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: "entries[] required" }, { status: 400 });
    }
    return NextResponse.json(await reorderAgenda(user, id, entries));
  },
);
