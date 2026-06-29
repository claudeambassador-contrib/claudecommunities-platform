import { type NextRequest, NextResponse } from "next/server";
import { getTenantConfig } from "@/lib/tenant-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sendId: string; url: string }> },
) {
  const { sendId, url } = await params;

  // Decode the base64url-encoded URL
  const decodedUrl = Buffer.from(url, "base64url").toString("utf8");

  // Validate the URL starts with http:// or https://
  const isValid = decodedUrl.startsWith("http://") || decodedUrl.startsWith("https://");
  const redirectUrl = isValid ? decodedUrl : (await getTenantConfig()).siteUrl;

  // Fire-and-forget: update DB without blocking the redirect
  (async () => {
    try {
      const { getPlatformPrisma, getPrisma } = await import("@/lib/prisma");
      const { runWithTenant } = await import("@/lib/tenant-context");

      // Inbound click redirect — no tenant in context. Resolve the send's tenant
      // cross-tenant by its unique id on the platform client, then re-enter that
      // tenant so the scoped writes inject tenantId (not the "" default).
      const platform = await getPlatformPrisma();
      const existingSend = await platform.emailSend.findUnique({
        where: { id: sendId },
        select: { campaignId: true, clickedAt: true, tenantId: true },
      });

      if (!existingSend) return;

      await runWithTenant(existingSend.tenantId, async () => {
        const prisma = await getPrisma();

        // Increment clickCount and set clickedAt if this is the first click
        const send = await prisma.emailSend.update({
          where: { id: sendId },
          data: {
            clickCount: { increment: 1 },
            ...(existingSend.clickedAt ? {} : { clickedAt: new Date() }),
          },
          select: { campaignId: true },
        });

        // Increment campaign-level click count
        await prisma.emailCampaign.update({
          where: { id: send.campaignId },
          data: { clickCount: { increment: 1 } },
        });

        // Create tracking event
        await prisma.emailTrackingEvent.create({
          data: {
            campaignId: send.campaignId,
            sendId,
            eventType: "click",
            url: decodedUrl,
            userAgent: request.headers.get("user-agent") || null,
            ipAddress: request.headers.get("x-forwarded-for") || null,
          },
        });
      });
    } catch {
      // Silently ignore DB errors — tracking should never break the redirect
    }
  })();

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
