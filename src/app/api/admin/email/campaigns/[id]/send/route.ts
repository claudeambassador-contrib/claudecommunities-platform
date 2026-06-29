import { type NextRequest, NextResponse } from "next/server";
import { requirePermissionResponse } from "@/lib/route-auth";
import { enqueueCampaignSend } from "@/lib/services/emailCampaigns";

// POST - Kick off a durable CampaignSendWorkflow for this campaign.
// Recipient resolution + suppression filtering happen inside the workflow
// so they survive Worker restarts. The acting admin's tenant (request header)
// scopes everything via enqueueCampaignSend.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("email.send");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await enqueueCampaignSend(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  console.warn(`[campaign-send] kickoff campaign=${id} workflow=${result.workflowId}`);
  return NextResponse.json({
    success: true,
    message:
      "Campaign send started. The workflow resolves recipients and sends in durable batches; " +
      "check campaign stats for progress.",
    workflowId: result.workflowId,
  });
}
