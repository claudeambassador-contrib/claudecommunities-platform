import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// GET - Real per-status counts derived from EmailSend records. Use this when
// the campaign-level sentCount/failedCount counters are stale because the
// background send worker died mid-loop (the counters only update at the very
// end of the send loop).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const prisma = await getPrisma();

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const grouped = await prisma.emailSend.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.status] = row._count._all;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    campaign,
    actual: {
      total,
      sent: counts.sent || 0,
      failed: counts.failed || 0,
      pending: counts.pending || 0,
      otherByStatus: counts,
    },
  });
}
