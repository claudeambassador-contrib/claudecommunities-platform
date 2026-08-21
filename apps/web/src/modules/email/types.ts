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

export interface CampaignWorkflowInput {
  campaignId: string;
  d1Binding: string;
  orgId: string;
}

export interface CampaignWorkflow {
  start: (input: CampaignWorkflowInput) => Promise<{ workflowId: string }>;
}

export const AUTOMATION_TRIGGERS = ["signup", "event_rsvp", "manual"] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_STATUSES = ["draft", "active", "paused"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const AUTOMATION_LIVE_STATUSES = ["active", "paused"] as const;
export type AutomationLiveStatus = (typeof AUTOMATION_LIVE_STATUSES)[number];

export interface AutomationCreateBody {
  name: string;
  triggerType: string;
}

export interface AutomationDetail {
  createdAt: string;
  id: string;
  name: string;
  status: AutomationStatus;
  triggerType: AutomationTrigger;
  updatedAt: string;
}

export interface EmailSettingsInput {
  senderEmail?: string | null;
  senderName?: string | null;
  trackClicks?: boolean;
  trackOpens?: boolean;
}

export interface EmailSettingsDetail {
  id: string | null;
  senderEmail: string;
  senderName: string;
  trackClicks: boolean;
  trackOpens: boolean;
}

export const EMAIL_SETTINGS_DEFAULTS: EmailSettingsDetail = {
  id: null,
  senderEmail: "",
  senderName: "",
  trackClicks: true,
  trackOpens: true,
};

export interface CampaignSendCount {
  campaignId: string | null;
  sent: number;
}

export interface EmailAnalytics {
  byCampaign: CampaignSendCount[];
  queued: number;
  totalSends: number;
}
