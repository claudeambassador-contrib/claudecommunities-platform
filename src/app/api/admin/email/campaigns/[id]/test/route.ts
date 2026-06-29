import { type NextRequest, NextResponse } from "next/server";
import { renderCampaignHtml } from "@/lib/email/blocks";
import { getPrisma } from "@/lib/prisma";
import { sendEmail, wrapEmailContent } from "@/lib/resend";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantConfig } from "@/lib/tenant-config";

// POST - Send test email to specified address
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("email.send");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;
  const { email: testEmail } = await request.json();

  const prisma = await getPrisma();

  // Use provided email or current user's email
  const targetEmail = testEmail || user.email;
  if (!targetEmail) {
    return NextResponse.json({ error: "No email address provided" }, { status: 400 });
  }

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const config = await getTenantConfig();

  // Regenerate HTML from blocks when available so fixes to blockToHtml
  // propagate to existing campaigns without requiring a manual re-save.
  const renderedHtml = renderCampaignHtml(campaign.html, campaign.blocks, {
    siteUrl: config.siteUrl,
  });

  // Personalize HTML with test data
  const personalizedHtml = renderedHtml
    .replace(/\{\{name\}\}/g, user.name || "Test User")
    .replace(/\{\{email\}\}/g, targetEmail);

  // wrapEmailContent normalizes any embedded doctype/html/body tags so legacy
  // campaigns and full-document templates both render correctly.
  const finalHtml = wrapEmailContent(personalizedHtml, { appUrl: config.appUrl });

  // Send test email
  const result = await sendEmail({
    to: targetEmail,
    subject: `[TEST] ${campaign.subject}`,
    html: finalHtml,
  });

  if (result.success) {
    return NextResponse.json({ success: true, sentTo: targetEmail });
  } else {
    return NextResponse.json(
      { error: "Failed to send test email", details: result.error },
      { status: 500 },
    );
  }
}
