import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";

// Verify a Resend (Svix) webhook signature.
// Header format: "v1,<base64sig> v1,<base64sig> ..."
// Signed payload: "<svix-id>.<svix-timestamp>.<rawBody>"
// Secret format: "whsec_<base64-secret>"
function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignatureHeader: string,
  secret: string,
): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const provided = svixSignatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  return provided.some((sig) => {
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(expected, "base64");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RESEND_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
    }

    // Replay protection: reject timestamps outside a 5-minute window
    const tsSec = Number(svixTimestamp);
    if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) {
      return NextResponse.json({ error: "Stale timestamp" }, { status: 401 });
    }

    const rawBody = await request.text();

    if (!verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventType = body.type; // e.g., "email.delivered", "email.bounced", "email.complained"
    const data = body.data;

    if (!eventType || !data) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Find the EmailSend by Resend message ID
    const resendMessageId = data.email_id;
    if (!resendMessageId) {
      return NextResponse.json({ received: true }); // Acknowledge but skip
    }

    // The webhook has NO tenant in context (Resend calls us directly, and the
    // route is selfTenanted so middleware stamps no x-tenant-id). Look the send
    // up cross-tenant by its globally-unique Resend id on the platform client,
    // then re-enter ITS tenant for every scoped write so tenantId is injected
    // (not the "" default). EmailSuppressionList is global (email @unique, no
    // tenantId) → it stays on the platform client.
    const platform = await getPlatformPrisma();
    const send = await platform.emailSend.findFirst({
      where: { resendMessageId },
      select: { id: true, tenantId: true, campaignId: true, userId: true },
    });

    if (!send) {
      return NextResponse.json({ received: true }); // No matching send
    }

    await runWithTenant(send.tenantId, async () => {
      const prisma = await getPrisma();

      switch (eventType) {
        case "email.delivered":
          await prisma.emailSend.update({
            where: { id: send.id },
            data: { deliveredAt: new Date(), status: "delivered" },
          });
          break;

        case "email.bounced":
          await prisma.emailSend.update({
            where: { id: send.id },
            data: {
              bouncedAt: new Date(),
              bounceType: data.bounce?.type || "unknown",
              status: "bounced",
            },
          });
          // Update campaign bounce count
          await prisma.emailCampaign.update({
            where: { id: send.campaignId },
            data: { bounceCount: { increment: 1 } },
          });
          // Add to suppression list for hard bounces (global)
          if (data.bounce?.type === "hard" && data.to?.[0]) {
            await platform.emailSuppressionList.upsert({
              where: { email: data.to[0] },
              create: {
                email: data.to[0],
                reason: "bounce",
                source: "webhook",
                bounceType: "hard",
              },
              update: {},
            });
          }
          break;

        case "email.complained":
          await prisma.emailSend.update({
            where: { id: send.id },
            data: { status: "complained" },
          });
          if (data.to?.[0]) {
            await platform.emailSuppressionList.upsert({
              where: { email: data.to[0] },
              create: { email: data.to[0], reason: "complaint", source: "webhook" },
              update: {},
            });
          }
          break;
      }

      // Create tracking event for all webhook types
      await prisma.emailTrackingEvent.create({
        data: {
          campaignId: send.campaignId,
          sendId: send.id,
          userId: send.userId,
          eventType: eventType.replace("email.", ""),
          metadata: JSON.stringify(data),
        },
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ received: true }); // Always 200 to prevent retries
  }
}
