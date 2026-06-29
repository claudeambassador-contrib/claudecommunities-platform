import { NextResponse } from "next/server";

import { withService } from "@/lib/services/_route";
import { listSpaces } from "@/lib/services/spaces";

export const GET = withService(async () => {
  return NextResponse.json(await listSpaces());
});
