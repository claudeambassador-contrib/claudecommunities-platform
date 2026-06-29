import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";

/**
 * Send16 outbound webhook receiver.
 *
 * Mirrors the Resend webhook handler (`../resend/route.ts`) for the Send16
 * transport. When campaigns are sent via Send16 (EMAIL_PROVIDER=send16), the
 * campaign workflow stores Send16's transactional `log_id` in
 * `EmailSend.resendMessageId` (the generic provider-message-id column), and
 * Send16 dispatches engagement events here so we can update the same rows.
 *
 * We only act on the events Send16 is the source of truth for — `delivered`
 * and `bounced`. Opens and clicks are tracked app-side via the injected
 * tracking pixel + click-redirect (provider-agnostic), so we deliberately
 * ignore `email.opened` / `email.clicked` here to avoid double-counting.
 *
 * Signature: Send16 sends `X-Webhook-Signature: sha256=<hex>` where <hex> =
 * HMAC-SHA256(rawBody, secret). The secret is the plaintext webhook secret
 * shown once when the outgoing webhook is created in the Send16 workspace;
 * set it as the SEND16_WEBHOOK_SECRET Worker secret. (See send16's
 * webhook-dispatcher.ts for the signing side.)
 */
function verifySend16Signature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const [algo, provided] = signatureHeader.split("=");
  if (algo !== "sha256" || !provided) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const secret = process.env.SEND16_WEBHOOK_SECRET;
    if (!secret) {
      console.error("SEND16_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const signature = request.headers.get("x-webhook-signature");
    const rawBody = await request.text();

    if (!verifySend16Signature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Replay protection: X-Webhook-Timestamp is ISO-8601; reject >5min skew.
    const tsHeader = request.headers.get("x-webhook-timestamp");
    if (tsHeader) {
      const ts = Date.parse(tsHeader);
      if (Number.isFinite(ts) && Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
        return NextResponse.json({ error: "Stale timestamp" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody) as {
      event?: string;
      data?: {
        logId?: string;
        messageId?: string;
        to?: string;
        bounceType?: string;
        status?: string;
      };
    };
    const eventType = body.event;
    const data = body.data;

    if (!eventType || !data) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Correlate on the Send16 log_id stored in resendMessageId at send time.
    const providerId = data.logId;
    if (!providerId) {
      return NextResponse.json({ received: true }); // nothing to correlate
    }

    // No tenant in context (Send16 calls us directly; the route is selfTenanted
    // so middleware stamps no x-tenant-id). Look the send up cross-tenant by its
    // globally-unique Send16 log_id on the platform client, then re-enter ITS
    // tenant for every scoped write so tenantId is injected (not the "" default).
    // EmailSuppressionList is global (email @unique, no tenantId) → platform client.
    const platform = await getPlatformPrisma();
    const send = await platform.emailSend.findFirst({
      where: { resendMessageId: providerId },
      select: { id: true, tenantId: true, campaignId: true, userId: true },
    });

    if (!send) {
      return NextResponse.json({ received: true }); // not one of ours
    }

    await runWithTenant(send.tenantId, async () => {
      const prisma = await getPrisma();

      switch (eventType) {
        case "email.delivered":
          await prisma.emailSend.update({
            where: { id: send.id },
            data: { deliveredAt: new Date(), status: "delivered" },
          });
          await prisma.emailTrackingEvent.create({
            data: {
              campaignId: send.campaignId,
              sendId: send.id,
              userId: send.userId,
              eventType: "delivered",
              metadata: JSON.stringify(data),
            },
          });
          break;

        case "email.bounced": {
          const bounceType = data.bounceType || "unknown";
          await prisma.emailSend.update({
            where: { id: send.id },
            data: { bouncedAt: new Date(), bounceType, status: "bounced" },
          });
          await prisma.emailCampaign.update({
            where: { id: send.campaignId },
            data: { bounceCount: { increment: 1 } },
          });
          // Suppress hard bounces so future campaigns skip them. (global list)
          if (bounceType === "hard" && data.to) {
            await platform.emailSuppressionList.upsert({
              where: { email: data.to },
              create: { email: data.to, reason: "bounce", source: "webhook", bounceType: "hard" },
              update: {},
            });
          }
          await prisma.emailTrackingEvent.create({
            data: {
              campaignId: send.campaignId,
              sendId: send.id,
              userId: send.userId,
              eventType: "bounced",
              metadata: JSON.stringify(data),
            },
          });
          break;
        }

        // email.opened / email.clicked: intentionally ignored — tracked app-side
        // via the injected pixel + click redirect to avoid double-counting.
        default:
          break;
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Send16 webhook processing error:", error);
    return NextResponse.json({ received: true }); // Always 200 to prevent retries
  }
}
