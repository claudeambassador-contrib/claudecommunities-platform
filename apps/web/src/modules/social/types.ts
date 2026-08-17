export type SocialPlatform = "linkedin";
export type ConnectorId = "linkedin" | "zernio";
export type SocialMediaType = "none" | "image" | "multi_image" | "video" | "document";
export type SocialPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";
export type SocialPostAction = "draft" | "scheduled" | "publish";

export interface SocialAccountSummary {
  accountType: "organization" | "person";
  avatarUrl: string | null;
  connector: ConnectorId;
  displayName: string;
  expiresAt: string | null;
  externalId: string;
  id: string;
  isExpired: boolean;
  platform: SocialPlatform;
}

export interface SocialAccountInput {
  accountType?: "organization" | "person";
  avatarUrl?: string | null;
  connector: ConnectorId;
  displayName: string;
  expiresAt?: string | null;
  externalId: string;
  platform: SocialPlatform;
}

export interface SocialPostAccount {
  avatarUrl: string | null;
  connector: ConnectorId;
  displayName: string;
}

export interface SocialPostSummary {
  account: SocialPostAccount;
  accountId: string;
  content: string;
  createdAt: string;
  errorMessage: string | null;
  externalId: string | null;
  externalUrl: string | null;
  id: string;
  mediaType: SocialMediaType;
  mediaUrls: string[];
  platform: SocialPlatform;
  publishedAt: string | null;
  scheduledAt: string | null;
  status: SocialPostStatus;
  updatedAt: string;
}

export interface SocialPostInput {
  accountId: string;
  action?: SocialPostAction;
  content: string;
  mediaType?: SocialMediaType;
  mediaUrls?: string[];
  scheduledAt?: string | null;
}

export interface SocialPostUpdate {
  content?: string;
  mediaType?: SocialMediaType;
  mediaUrls?: string[];
  scheduledAt?: string | null;
  status?: Extract<SocialPostStatus, "draft" | "scheduled" | "cancelled">;
}

export interface SocialPostListOptions {
  accountId?: string;
  limit?: number;
  platform?: SocialPlatform;
  range?: "past" | "upcoming" | "all";
  status?: SocialPostStatus[];
}

export interface ConnectorCapabilities {
  maxTextLength: number;
}

export interface SocialPublishRequest {
  accessToken?: string | null;
  content: string;
  mediaType: SocialMediaType;
  mediaUrls: string[];
  scheduledFor?: Date;
}

export interface SocialPublishResult {
  externalId: string;
  externalUrl: string | null;
}

export interface SocialConnector {
  capabilities: ConnectorCapabilities;
  deleteRemote?: (input: { externalId: string }) => Promise<void>;
  id: ConnectorId;
  publish: (input: SocialPublishRequest) => Promise<SocialPublishResult>;
  supportsNativeScheduling: boolean;
  updateRemote?: (input: {
    content: string;
    externalId: string;
    scheduledFor?: Date;
  }) => Promise<void>;
}

export interface SocialPublishWorkflow {
  start: (input: { postId: string }) => Promise<{ workflowId: string }>;
}

export interface SocialDeps {
  connector?: SocialConnector;
  workflow?: SocialPublishWorkflow;
}

export interface SocialAccountWrite {
  accountType: "organization" | "person";
  avatarUrl?: string | null;
  connector: ConnectorId;
  displayName: string;
  expiresAt?: Date | null;
  externalId: string;
  platform: SocialPlatform;
}

export interface SocialPostWrite {
  accountId: string;
  content: string;
  createdById: string;
  mediaType: SocialMediaType;
  mediaUrls: string[];
  platform: SocialPlatform;
  scheduledAt?: Date | null;
  status: SocialPostStatus;
}
