import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { validateApiKey } from "@/lib/services/socialAccounts";

/**
 * Step 1 of the Zernio connect flow: admin pastes their Zernio API key;
 * we call Zernio /accounts?platform=linkedin and return the list of
 * accounts the key can post to. The UI then lets the admin pick which to
 * persist via /connect.
 */
export const POST = withService(async (req) => {
  const user = await requireSessionUser();
  const { apiKey } = (await req.json()) as { apiKey?: string };
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }
  const accounts = await validateApiKey(user, "zernio", apiKey);
  return NextResponse.json({ accounts });
});
