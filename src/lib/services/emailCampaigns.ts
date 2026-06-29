/**
 * Email-campaign send orchestration. Two entry points share one tenant-scoped
 * dispatch so the admin "send now" route and the scheduled-send cron can't drift:
 *
 * - `enqueueCampaignSend(id)` — kick off the durable CampaignSendWorkflow for ONE
 *   campaign IN THE CURRENT TENANT SCOPE. The caller must already be inside a
 *   tenant scope (request header on the admin route, or `runWithTenant` per
 *   campaign in the cron). getTenantId()/getPrisma()/getTenantConfig() all resolve
 *   from that scope, so the campaign is read + flipped under its own tenant.
 * - `sendDueScheduledCampaigns()` — the cron drain: read due campaigns ACROSS all
 *   tenants via the platform client (just {id, tenantId}), then enqueue each under
 *   `runWithTenant(tenantId, …)`. This replaces the old single-host `appUrl()`
 *   fetch that would have sent every tenant's campaign under the apex's scope.
 */
import { getEnv } from "@/lib/cf-env";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId, runWithTenant } from "@/lib/tenant-context";
import type { CampaignSendParams } from "@/workflows/campaign-send";

export type EnqueueResult =
  | { ok: true; workflowId: string }
  | { ok: false; status: number; error: string };

/** Kick off CampaignSendWorkflow for `campaignId` in the current tenant scope. */
export async function enqueueCampaignSend(campaignId: string): Promise<EnqueueResult> {
  const tenantId = await getTenantId();
  const db = await getPrisma(); // scoped to tenantId — a campaign in another tenant won't be found
  const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, status: 404, error: "Campaign not found" };
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return { ok: false, status: 400, error: "Campaign has already been sent" };
  }

  const env = getEnv() as unknown as { CAMPAIGN_SEND?: Workflow<CampaignSendParams> };
  if (!env.CAMPAIGN_SEND) {
    return {
      ok: false,
      status: 503,
      error: "CAMPAIGN_SEND workflow binding is not configured on this environment",
    };
  }

  const baseUrl = (await getTenantConfig()).appUrl;
  const workflowId = `campaign-${campaignId}-${Date.now()}`;

  // Flip to `sending` before kicking the workflow so the admin UI shows movement
  // immediately; the workflow updates recipient/sent/failed counts as it runs.
  await db.emailCampaign.update({
    where: { id: campaignId },
    data: { status: "sending", sentCount: 0, failedCount: 0 },
  });

  try {
    await env.CAMPAIGN_SEND.create({
      id: workflowId,
      params: {
        campaignId,
        tenantId,
        workflowId,
        baseUrl,
        campaignSubject: campaign.subject,
        campaignHtml: campaign.html,
        campaignBlocks: campaign.blocks,
        accumulateCounters: false,
      },
    });
  } catch (err) {
    // Leave the row on `sending` — rare; an operator can resume manually.
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Failed to start campaign workflow",
    };
  }

  return { ok: true, workflowId };
}

export interface ScheduledSendOutcome {
  id: string;
  tenantId: string;
  status: "queued" | "failed";
  workflowId?: string;
  error?: string;
}

/** Drain every tenant's due scheduled campaigns, each enqueued under its own scope. */
export async function sendDueScheduledCampaigns(
  now: Date = new Date(),
): Promise<ScheduledSendOutcome[]> {
  // Cross-tenant read via the platform client (registry plane): just the ids +
  // tenant. Each campaign is then sent under its OWN tenant via runWithTenant.
  const platform = await getPlatformPrisma();
  const due = await platform.emailCampaign.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    select: { id: true, tenantId: true },
  });

  const outcomes: ScheduledSendOutcome[] = [];
  for (const { id, tenantId } of due) {
    const result = await runWithTenant(tenantId, () => enqueueCampaignSend(id));
    outcomes.push(
      result.ok
        ? { id, tenantId, status: "queued", workflowId: result.workflowId }
        : { id, tenantId, status: "failed", error: result.error },
    );
  }
  return outcomes;
}
