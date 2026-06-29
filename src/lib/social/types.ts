/**
 * Shared types for the social posting subsystem.
 *
 * Two layered concepts:
 * - "Platform" = the social network the post lands on ("linkedin").
 * - "Connector" = the integration used to reach a platform. Multiple
 *   connectors can target the same platform; one example: posting to
 *   LinkedIn directly via OAuth vs. routing through zernio.com.
 *
 * Account = one connected target via one connector (e.g. one LinkedIn
 * company page reached through Zernio).
 *
 * The provider abstraction (see ./providers/types.ts) means everything
 * connector-specific lives behind a SocialProvider implementation;
 * this file stays connector-agnostic.
 */

export type SocialPlatform = "linkedin";

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["linkedin"];

/**
 * Connector IDs. Stable strings stored in SocialAccount.connector and used
 * as the registry key in providers/registry.ts.
 *
 * - "linkedin" — direct LinkedIn REST API via OAuth (Community Management
 *   API approval required).
 * - "zernio"   — post via zernio.com using a Zernio API key. LinkedIn
 *   account connection happens in Zernio's dashboard.
 */
export type ConnectorId = "linkedin" | "zernio";

export const CONNECTOR_IDS: ConnectorId[] = ["linkedin", "zernio"];

export type SocialMediaType = "none" | "image" | "multi_image" | "video" | "document";

export type SocialPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export interface SocialAccountSummary {
  id: string;
  platform: SocialPlatform;
  connector: ConnectorId;
  accountType: "organization" | "person";
  externalId: string;
  displayName: string;
  avatarUrl: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

export interface SocialPostSummary {
  id: string;
  accountId: string;
  account: {
    displayName: string;
    avatarUrl: string | null;
    connector: ConnectorId;
  };
  platform: SocialPlatform;
  content: string;
  mediaType: SocialMediaType;
  mediaUrls: string[];
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformCapabilities {
  text: boolean;
  singleImage: boolean;
  multiImage: { supported: boolean; max: number };
  video: boolean;
  // Swipeable carousel-style document (PDF) post.
  document: boolean;
  // Maximum body text length in characters.
  maxTextLength: number;
}
