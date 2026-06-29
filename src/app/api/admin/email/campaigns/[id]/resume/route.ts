import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cf-env";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import type { CampaignSendParams } from "@/workflows/campaign-send";

// POST - Resume a stuck/partial send by starting a fresh
// CampaignSendWorkflow instance. The workflow's `resolve-segment` step
// re-queries the segment and skips anyone with an existing EmailSend row,
// so duplicates are impossible (also enforced by
// @@unique([campaignId, userId])). Safe to call multiple times.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("email.send");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const prisma = await getPrisma();

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const env = getEnv() as unknown as { CAMPAIGN_SEND?: Workflow<CampaignSendParams> };
  if (!env.CAMPAIGN_SEND) {
    return NextResponse.json(
      { error: "CAMPAIGN_SEND workflow binding is not configured on this environment" },
      { status: 503 },
    );
  }

  const baseUrl = (await getTenantConfig()).appUrl;
  // The acting admin's tenant (request header). The workflow scopes everything
  // to it and fail-closes (resolve-segment) if the campaign isn't in it.
  const tenantId = await getTenantId();
  const workflowId = `campaign-${id}-resume-${Date.now()}`;

  // Flip back to `sending` so the UI reflects the in-progress state. The
  // workflow accumulates counters on top of the existing sentCount /
  // failedCount.
  await prisma.emailCampaign.update({
    where: { id },
    data: { status: "sending" },
  });

  // biome-ignore lint/suspicious/noConsole: operational resume log for the durable CampaignSendWorkflow (see docs/email-campaigns.md log vocabulary)
  console.log(
    `[campaign-send] resume campaign=${id} workflow=${workflowId} ` +
      `prevSent=${campaign.sentCount} prevFailed=${campaign.failedCount}`,
  );

  try {
    await env.CAMPAIGN_SEND.create({
      id: workflowId,
      params: {
        campaignId: id,
        tenantId,
        workflowId,
        baseUrl,
        campaignSubject: campaign.subject,
        campaignHtml: campaign.html,
        campaignBlocks: campaign.blocks,
        accumulateCounters: true,
      },
    });
  } catch (err) {
    console.error(
      `[campaign-send] resume workflow create failed campaign=${id} workflow=${workflowId}:`,
      err,
    );
    return NextResponse.json(
      {
        error: "Failed to start resume workflow",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "Resume workflow started. Recipients already handled (sent, pending, or failed) " +
      "will be skipped; the rest will be sent in durable batches.",
    workflowId,
  });
}
