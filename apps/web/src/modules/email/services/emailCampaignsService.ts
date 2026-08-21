import { and, eq, lte } from "drizzle-orm";

import type {
  CampaignCreateBody,
  CampaignDetail,
  CampaignStatus,
  CampaignUpdateBody,
  CampaignWorkflow,
  TemplateCreateBody,
  TemplateDetail,
} from "@/modules/email/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";
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

export async function getCampaign(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ campaign: CampaignDetail }>> {
  const perm = ensurePermission(actor, "email.view");
  if (!perm.ok) {
    return perm;
  }
  const { emailCampaigns } = store.tables;
  const rows = await store.db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.orgId, store.orgId), eq(emailCampaigns.id, id)))
    .limit(1);
  const [row] = rows;
  if (!row) {
    return err("not_found", 404, "Campaign not found");
  }
  return ok({ campaign: toCampaign(row) });
}

export async function updateCampaign(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: CampaignUpdateBody,
): Promise<Result<{ campaign: CampaignDetail }>> {
  const perm = ensurePermission(actor, "email.edit");
  if (!perm.ok) {
    return perm;
  }
  const existing = await getCampaign(store, actor, id);
  if (!existing.ok) {
    return existing;
  }
  if (existing.campaign.status !== "draft" && existing.campaign.status !== "scheduled") {
    return err("bad_request", 400, "Only draft or scheduled campaigns can be edited");
  }
  const name = input.name?.trim() ?? existing.campaign.name;
  const subject = input.subject?.trim() ?? existing.campaign.subject;
  if (!(name && subject)) {
    return err("bad_request", 400, "name and subject are required");
  }
  let scheduledAt = existing.campaign.scheduledAt ? new Date(existing.campaign.scheduledAt) : null;
  if (input.scheduledAt !== undefined) {
    scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  }
  const status = input.status ?? (scheduledAt ? "scheduled" : existing.campaign.status);
  const { emailCampaigns } = store.tables;
  await store.db
    .update(emailCampaigns)
    .set({
      bodyHtml: input.bodyHtml === undefined ? existing.campaign.bodyHtml : input.bodyHtml,
      name,
      scheduledAt,
      status,
      subject,
      updatedAt: new Date(),
    })
    .where(and(eq(emailCampaigns.orgId, store.orgId), eq(emailCampaigns.id, id)));
  return getCampaign(store, actor, id);
}

export function campaignWorkflowFromEnv(
  env: Record<string, unknown>,
): CampaignWorkflow | undefined {
  const binding = env.CAMPAIGN_SEND as
    | { create?: (opts: { params: unknown }) => Promise<{ id?: string }> }
    | undefined;
  const create = binding?.create;
  if (!create) {
    return undefined;
  }
  return {
    async start(input) {
      const instance = await create({ params: input });
      return { workflowId: instance.id ?? "campaign-send" };
    },
  };
}

export async function startCampaignSend(
  store: TenantStore,
  campaignId: string,
  workflow: CampaignWorkflow,
): Promise<Result<{ workflowId: string }>> {
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
    const started = await workflow.start({
      campaignId,
      d1Binding: store.binding,
      orgId: store.orgId,
    });
    return ok({ workflowId: started.workflowId });
  } catch (error) {
    return err("workflow_failed", 500, error instanceof Error ? error.message : "Failed to start");
  }
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
  return await startCampaignSend(store, campaignId, workflow);
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
