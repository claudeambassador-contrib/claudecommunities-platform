/**
 * SocialProvider — what every connector implementation must implement.
 *
 * A connector owns:
 *  1. Its label + the destination platforms it supports
 *  2. A connect flow — EITHER an OAuth dance OR API-key validation
 *  3. Publishing (turn an internal post into a platform-side post)
 *
 * The registry (./registry.ts) keys connectors by their `id` (e.g.
 * "linkedin", "zernio") — not by destination platform — so multiple
 * connectors can route to the same network.
 *
 * Providers receive media as `{ url, mimeType, bytes? }`. Some connectors
 * upload bytes themselves (LinkedIn direct), others reference a public
 * URL the platform fetches (Zernio).
 */

import type { ConnectorId, PlatformCapabilities, SocialMediaType, SocialPlatform } from "../types";

export type ConnectKind = "oauth" | "api_key";

export interface OAuthConnectableAccount {
  externalId: string;
  displayName: string;
  accountType: "organization" | "person";
  avatarUrl?: string | null;
  // Destination platform this account posts to.
  platform: SocialPlatform;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string | null;
}

export interface OAuthExchangeResult extends OAuthTokens {
  /** Accounts the user can post to with this token. UI lets admin pick. */
  accounts: OAuthConnectableAccount[];
}

export interface ApiKeyValidationResult {
  /** Accounts visible under this API key, that the user can connect. */
  accounts: OAuthConnectableAccount[];
}

export interface ProviderMediaItem {
  /** R2-backed public URL or any HTTPS URL the provider can fetch. */
  url: string;
  mimeType: string;
  /** Optional fetched bytes — providers can fetch themselves if absent. */
  bytes?: ArrayBuffer;
}

export interface ProviderPublishRequest {
  account: {
    externalId: string;
    accountType: "organization" | "person";
    accessToken: string; // OAuth token OR API key, depending on connectKind
    platform: SocialPlatform;
  };
  content: string;
  mediaType: SocialMediaType;
  media: ProviderMediaItem[];
  /**
   * For "schedule via the connector" — only used if the caller wants the
   * external service to handle scheduling. Local scheduling (our cron
   * route) is the default; in that case this is omitted.
   */
  scheduledFor?: Date;
}

export interface ProviderPublishResult {
  externalId: string;
  externalUrl: string | null;
}

export interface SocialProvider {
  /** Registry key. Matches SocialAccount.connector. */
  id: ConnectorId;
  label: string;
  /** Destination platforms this connector can post to. */
  platforms: SocialPlatform[];
  /** Capabilities per destination platform. */
  capabilities: Partial<Record<SocialPlatform, PlatformCapabilities>>;
  connectKind: ConnectKind;
  /**
   * True when the connector runs its own scheduler (e.g. Zernio). For these,
   * a scheduled post is handed off immediately with `scheduledFor` set and
   * the external service fires it at the exact minute — we don't wait for our
   * own ~15-minute cron. False (the default behaviour) means our cron drains
   * the post at its `scheduledAt`.
   */
  supportsNativeScheduling: boolean;

  // ── OAuth-flow connectors ─────────────────────────────────────────
  buildAuthorizeUrl?(params: { state: string; redirectUri: string }): string;
  exchangeCode?(params: { code: string; redirectUri: string }): Promise<OAuthExchangeResult>;
  refreshToken?(refreshToken: string): Promise<OAuthTokens>;

  // ── API-key-flow connectors ───────────────────────────────────────
  validateApiKey?(apiKey: string): Promise<ApiKeyValidationResult>;

  // ── Publishing ────────────────────────────────────────────────────
  publish(req: ProviderPublishRequest): Promise<ProviderPublishResult>;

  // ── Managing already-handed-off posts (native-scheduling connectors) ──
  // Only implemented by connectors that hold the post on their side after
  // a scheduled handoff (Zernio). Lets us keep the connector in sync when
  // an admin edits or deletes a delegated post.
  /** Push content/schedule changes to the connector's copy of the post. */
  updateRemote?(req: {
    externalId: string;
    accessToken: string;
    content: string;
    scheduledFor?: Date;
  }): Promise<void>;
  /** Cancel/remove the connector's copy of the post. Idempotent. */
  deleteRemote?(req: { externalId: string; accessToken: string }): Promise<void>;
}

export function isOAuthConnector(p: SocialProvider): p is SocialProvider & {
  buildAuthorizeUrl: NonNullable<SocialProvider["buildAuthorizeUrl"]>;
  exchangeCode: NonNullable<SocialProvider["exchangeCode"]>;
} {
  return p.connectKind === "oauth" && !!p.buildAuthorizeUrl && !!p.exchangeCode;
}

export function isApiKeyConnector(
  p: SocialProvider,
): p is SocialProvider & { validateApiKey: NonNullable<SocialProvider["validateApiKey"]> } {
  return p.connectKind === "api_key" && !!p.validateApiKey;
}
