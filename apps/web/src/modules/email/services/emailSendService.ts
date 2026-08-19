import { and, eq } from "drizzle-orm";
import type { EmailTransport } from "@/modules/email/transport";
import { listCampaignRecipients } from "@/modules/identity/services/usersService";
import type { RegistryStore } from "@/shared/db/registryStore";
import { first } from "@/shared/db/rows";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";
import { getRegionConfig } from "@/shared/region";

export interface CampaignSendSummary {
  failed: number;
  sent: number;
  skipped: number;
}

async function senderFrom(store: TenantStore): Promise<string> {
  const { emailSettings } = store.tables;
  const row = first(
    await store.db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.orgId, store.orgId))
      .limit(1),
  );
  const senderEmail = row?.senderEmail.trim() ?? "";
  const senderName = row?.senderName.trim() ?? "";
  if (senderEmail) {
    return senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  }
  return `hello@${getRegionConfig().senderDomain}`;
}

export async function sendCampaign(
  store: TenantStore,
  registry: RegistryStore,
  campaignId: string,
  transport: EmailTransport,
): Promise<Result<CampaignSendSummary>> {
  const { emailCampaigns, emailSends } = store.tables;
  const campaign = first(
    await store.db
      .select()
      .from(emailCampaigns)
      .where(and(eq(emailCampaigns.orgId, store.orgId), eq(emailCampaigns.id, campaignId)))
      .limit(1),
  );
  if (!campaign) {
    return err("not_found", 404, "Campaign not found");
  }

  const recipients = await listCampaignRecipients(registry, store.orgId);
  const already = await store.db
    .select({ toEmail: emailSends.toEmail })
    .from(emailSends)
    .where(and(eq(emailSends.orgId, store.orgId), eq(emailSends.campaignId, campaignId)));
  const sentSet = new Set(already.map((row) => row.toEmail.toLowerCase()));
  const pending = recipients.filter((row) => !sentSet.has(row.email));
  const from = await senderFrom(store);
  const html = campaign.bodyHtml ?? `<p>${campaign.subject}</p>`;
  const now = new Date();

  if (pending.length === 0) {
    await store.db
      .update(emailCampaigns)
      .set({ status: "sent", updatedAt: now })
      .where(eq(emailCampaigns.id, campaignId));
    return ok({ failed: 0, sent: 0, skipped: sentSet.size });
  }

  const results = await transport.sendBatch(
    pending.map((row) => ({
      from,
      html,
      subject: campaign.subject,
      to: row.email,
    })),
  );

  let sent = 0;
  let failed = 0;
  await store.db.insert(emailSends).values(
    results.map((result) => {
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
      }
      return {
        campaignId,
        createdAt: now,
        externalId: result.id ?? null,
        id: newId("esnd"),
        orgId: store.orgId,
        status: result.ok ? "sent" : "failed",
        toEmail: result.email,
      };
    }),
  );

  await store.db
    .update(emailCampaigns)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(emailCampaigns.id, campaignId));

  return ok({ failed, sent, skipped: sentSet.size });
}
