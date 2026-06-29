import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// Calculate the "since" date from a range string (null = all-time)
function resolveSinceDate(range: string): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 30;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  return sinceDate;
}

// GET - Email analytics overview
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    const sinceDate = resolveSinceDate(range);
    const dateFilter = sinceDate ? { gte: sinceDate } : undefined;

    // Aggregate from sent campaigns in the range
    const aggregation = await prisma.emailCampaign.aggregate({
      where: {
        status: "sent",
        ...(dateFilter ? { sentAt: dateFilter } : {}),
      },
      _sum: {
        sentCount: true,
        openCount: true,
        clickCount: true,
        bounceCount: true,
        unsubscribeCount: true,
      },
    });

    const totalSent = aggregation._sum.sentCount || 0;
    const totalOpens = aggregation._sum.openCount || 0;
    const totalClicks = aggregation._sum.clickCount || 0;
    const totalBounces = aggregation._sum.bounceCount || 0;
    const totalUnsubscribes = aggregation._sum.unsubscribeCount || 0;

    const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;
    const unsubscribeRate = totalSent > 0 ? (totalUnsubscribes / totalSent) * 100 : 0;

    // Get sent campaigns in the range
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        status: "sent",
        ...(dateFilter ? { sentAt: dateFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        subject: true,
        sentAt: true,
        sentCount: true,
        openCount: true,
        clickCount: true,
        bounceCount: true,
        failedCount: true,
      },
      orderBy: { sentAt: "desc" },
    });

    const campaignsWithRates = campaigns.map((c) => ({
      ...c,
      openRate: c.sentCount > 0 ? (c.openCount / c.sentCount) * 100 : 0,
      clickRate: c.sentCount > 0 ? (c.clickCount / c.sentCount) * 100 : 0,
    }));

    // Top clicked links
    const topLinks = await prisma.emailTrackingEvent.groupBy({
      by: ["url"],
      where: {
        eventType: "click",
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
        url: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const formattedTopLinks = topLinks.map((link) => ({
      url: link.url,
      count: link._count.id,
    }));

    return NextResponse.json({
      overview: {
        totalSent,
        totalOpens,
        totalClicks,
        totalBounces,
        totalUnsubscribes,
        openRate,
        clickRate,
        bounceRate,
        unsubscribeRate,
      },
      campaigns: campaignsWithRates,
      topLinks: formattedTopLinks,
    });
  } catch (error) {
    console.error("Email analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch email analytics" }, { status: 500 });
  }
}
