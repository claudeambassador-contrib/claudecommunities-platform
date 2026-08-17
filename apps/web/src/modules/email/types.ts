export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export interface CampaignCreateBody {
  bodyHtml?: string | null;
  name: string;
  scheduledAt?: string | null;
  subject: string;
}

export type CampaignUpdateBody = Partial<CampaignCreateBody> & { status?: CampaignStatus };

export interface CampaignDetail {
  bodyHtml: string | null;
  id: string;
  name: string;
  scheduledAt: string | null;
  status: CampaignStatus;
  subject: string;
}

export interface TemplateCreateBody {
  bodyHtml?: string | null;
  name: string;
  subject?: string | null;
}

export interface TemplateDetail {
  bodyHtml: string | null;
  id: string;
  name: string;
  subject: string | null;
}

export interface CampaignWorkflow {
  start: (input: { campaignId: string }) => Promise<{ workflowId: string }>;
}
