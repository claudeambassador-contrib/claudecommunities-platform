import { and, eq, lte } from "drizzle-orm";
import type {
  CampaignCreateBody,
  CampaignDetail,
  CampaignStatus,
  CampaignWorkflow,
  TemplateCreateBody,
  TemplateDetail,
} from "@/modules/email/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

function toCampaign(row: {
  bodyHtml: string | null;
  id: string;
  name: string;
  scheduledAt: Date | null;
  status: CampaignStatus;
  subject: string;
}): CampaignDetail {
  return {
    bodyHtml: row.bodyHtml,
    id: row.id,
    name: row.name,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    status: row.status,
    subject: row.subject,
  };
}

export async function listCampaigns(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ campaigns: CampaignDetail[] }>> {
  const perm = ensurePermission(actor, "email.view");
  if (!perm.ok) {
    return perm;
  }
  const { emailCampaigns } = store.tables;
  const rows = await store.db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.orgId, store.orgId));
  return ok({ campaigns: rows.map(toCampaign) });
}

export async function createCampaign(
  store: TenantStore,
  actor: Actor,
  input: CampaignCreateBody,
): Promise<Result<{ campaign: CampaignDetail }>> {
  const perm = ensurePermission(actor, "email.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!(input.name.trim() && input.subject.trim())) {
    return err("bad_request", 400, "name and subject are required");
  }
  const { emailCampaigns } = store.tables;
  const now = new Date();
  const id = newId("cmp");
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  await store.db.insert(emailCampaigns).values({
    bodyHtml: input.bodyHtml ?? null,
    createdAt: now,
    id,
    name: input.name.trim(),
    orgId: store.orgId,
    scheduledAt,
    status: scheduledAt ? "scheduled" : "draft",
    subject: input.subject.trim(),
    updatedAt: now,
  });
  const listed = await listCampaigns(store, actor);
  if (!listed.ok) {
    return listed;
  }
  const campaign = listed.campaigns.find((row) => row.id === id);
  if (!campaign) {
    return err("not_found", 404, "Campaign not found");
  }
  return ok({ campaign });
}

export async function enqueueCampaignSend(
  store: TenantStore,
  actor: Actor,
  campaignId: string,
  workflow?: CampaignWorkflow,
): Promise<Result<{ workflowId: string }>> {
  const perm = ensurePermission(actor, "email.send");
  if (!perm.ok) {
    return perm;
  }
  if (!workflow) {
    return err("unavailable", 503, "CAMPAIGN_SEND workflow binding is not configured");
  }
  const { emailCampaigns } = store.tables;
  const rows = await store.db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.orgId, store.orgId), eq(emailCampaigns.id, campaignId)))
    .limit(1);
  const [campaign] = rows;
  if (!campaign) {
    return err("not_found", 404, "Campaign not found");
  }
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return err("bad_request", 400, "Campaign has already been sent");
  }
  await store.db
    .update(emailCampaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(and(eq(emailCampaigns.orgId, store.orgId), eq(emailCampaigns.id, campaignId)));
  try {
    const started = await workflow.start({ campaignId });
    return ok({ workflowId: started.workflowId });
  } catch (error) {
    return err("workflow_failed", 500, error instanceof Error ? error.message : "Failed to start");
  }
}

export async function listDueScheduled(
  store: TenantStore,
  now: Date = new Date(),
): Promise<Result<{ campaigns: CampaignDetail[] }>> {
  const { emailCampaigns } = store.tables;
  const rows = await store.db
    .select()
    .from(emailCampaigns)
    .where(
      and(
        eq(emailCampaigns.orgId, store.orgId),
        eq(emailCampaigns.status, "scheduled"),
        lte(emailCampaigns.scheduledAt, now),
      ),
    );
  return ok({ campaigns: rows.map(toCampaign) });
}

export async function listTemplates(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ templates: TemplateDetail[] }>> {
  const perm = ensurePermission(actor, "email.view");
  if (!perm.ok) {
    return perm;
  }
  const { emailTemplates } = store.tables;
  const rows = await store.db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.orgId, store.orgId));
  return ok({
    templates: rows.map((row) => ({
      bodyHtml: row.bodyHtml,
      id: row.id,
      name: row.name,
      subject: row.subject,
    })),
  });
}

export async function createTemplate(
  store: TenantStore,
  actor: Actor,
  input: TemplateCreateBody,
): Promise<Result<{ template: TemplateDetail }>> {
  const perm = ensurePermission(actor, "email.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!input.name.trim()) {
    return err("bad_request", 400, "name required");
  }
  const { emailTemplates } = store.tables;
  const id = newId("tpl");
  await store.db.insert(emailTemplates).values({
    bodyHtml: input.bodyHtml ?? null,
    createdAt: new Date(),
    id,
    name: input.name.trim(),
    orgId: store.orgId,
    subject: input.subject ?? null,
  });
  return ok({
    template: {
      bodyHtml: input.bodyHtml ?? null,
      id,
      name: input.name.trim(),
      subject: input.subject ?? null,
    },
  });
}
