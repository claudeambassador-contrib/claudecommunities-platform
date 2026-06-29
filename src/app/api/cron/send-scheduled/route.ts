import { NextResponse } from "next/server";
import { sendDueScheduledCampaigns } from "@/lib/services/emailCampaigns";

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Drains EVERY tenant's due scheduled campaigns — each read + enqueued under
    // its own runWithTenant scope, so a campaign always sends with its own
    // tenant's config (not the cron host's). Replaces the old single-host fetch.
    const results = await sendDueScheduledCampaigns();
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("Scheduled send cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
