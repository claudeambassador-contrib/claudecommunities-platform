import { type NextRequest, NextResponse } from "next/server";

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sendId: string }> },
) {
  const { sendId } = await params;

  // Fire-and-forget: update DB without blocking the response
  (async () => {
    try {
      const { getPlatformPrisma, getPrisma } = await import("@/lib/prisma");
      const { runWithTenant } = await import("@/lib/tenant-context");

      // Inbound tracking pixel — no tenant in context. Resolve the send's tenant
      // cross-tenant by its unique id on the platform client, then re-enter that
      // tenant so the scoped writes inject tenantId (not the "" default).
      const platform = await getPlatformPrisma();
      const existingSend = await platform.emailSend.findUnique({
        where: { id: sendId },
        select: { campaignId: true, openedAt: true, tenantId: true },
      });

      if (!existingSend) return;

      await runWithTenant(existingSend.tenantId, async () => {
        const prisma = await getPrisma();

        // Increment openCount and set openedAt if this is the first open
        const send = await prisma.emailSend.update({
          where: { id: sendId },
          data: {
            openCount: { increment: 1 },
            ...(existingSend.openedAt ? {} : { openedAt: new Date() }),
          },
          select: { campaignId: true },
        });

        // Increment campaign-level open count
        await prisma.emailCampaign.update({
          where: { id: send.campaignId },
          data: { openCount: { increment: 1 } },
        });

        // Create tracking event
        await prisma.emailTrackingEvent.create({
          data: {
            campaignId: send.campaignId,
            sendId,
            eventType: "open",
            userAgent: request.headers.get("user-agent") || null,
            ipAddress: request.headers.get("x-forwarded-for") || null,
          },
        });
      });
    } catch {
      // Silently ignore DB errors — tracking should never break the pixel
    }
  })();

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
