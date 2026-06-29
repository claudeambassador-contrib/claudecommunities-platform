import { NextResponse } from "next/server";

import { withService } from "@/lib/services/_route";
import { listUsers } from "@/lib/services/users";

export const GET = withService(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  return NextResponse.json(await listUsers({ search, limit, offset }));
});
