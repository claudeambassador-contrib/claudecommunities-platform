import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/services/_auth";
import { withService } from "@/lib/services/_route";
import { saveApiKeyConnection, validateApiKey } from "@/lib/services/socialAccounts";

/**
 * Step 2 of the Zernio connect flow: persist the chosen subset of
 * accounts. Re-validates against Zernio so we always store a candidate
 * list that matches the current state of the key (rather than trusting
 * the client's previously-returned list).
 */
export const POST = withService(async (req) => {
  const user = await requireSessionUser();
  const { apiKey, externalIds } = (await req.json()) as {
    apiKey?: string;
    externalIds?: string[];
  };
  if (!apiKey || !Array.isArray(externalIds) || externalIds.length === 0) {
    return NextResponse.json(
      { error: "apiKey and a non-empty externalIds[] are required" },
      { status: 400 },
    );
  }
  const candidates = await validateApiKey(user, "zernio", apiKey);
  const result = await saveApiKeyConnection(user, "zernio", {
    apiKey,
    selectedExternalIds: externalIds,
    candidates,
  });
  return NextResponse.json(result);
});
