/**
 * Social accounts service — connect lifecycle + token resolution.
 *
 * Two connect flows are supported, keyed by the provider's `connectKind`:
 *  - OAuth (e.g. "linkedin"): redirect dance, state HMAC-signed for CSRF.
 *  - API key (e.g. "zernio"): user pastes key; we validate by listing
 *    accounts visible to that key, then persist their selection.
 */

import { getPrisma } from "@/lib/prisma";
import { getProvider } from "@/lib/social/providers/registry";
import {
  isApiKeyConnector,
  isOAuthConnector,
  type OAuthConnectableAccount,
} from "@/lib/social/providers/types";
import type { ConnectorId, SocialAccountSummary, SocialPlatform } from "@/lib/social/types";
import { getTenantId } from "@/lib/tenant-context";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

function getStateSecret(): string {
  const secret = process.env.SOCIAL_OAUTH_STATE_SECRET;
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "SOCIAL_OAUTH_STATE_SECRET worker secret is not configured",
    );
  }
  return secret;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

interface OAuthState {
  connector: ConnectorId;
  userId: string;
  ts: number;
}

export async function buildOAuthState(payload: OAuthState): Promise<string> {
  const json = JSON.stringify(payload);
  const sig = await hmacSign(getStateSecret(), json);
  return `${b64url(json)}.${sig}`;
}

export async function verifyOAuthState(state: string): Promise<OAuthState> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) throw new ServiceError("bad_request", "Invalid OAuth state");
  const json = b64urlDecode(payload);
  const expected = await hmacSign(getStateSecret(), json);
  if (expected !== sig) throw new ServiceError("bad_request", "OAuth state signature mismatch");
  const data = JSON.parse(json) as OAuthState;
  if (Date.now() - data.ts > 15 * 60 * 1000) {
    throw new ServiceError("bad_request", "OAuth state expired");
  }
  return data;
}

/**
 * Build the OAuth redirect URI for a connector. Must exactly match the URI
 * registered in the connector's developer app.
 */
export function getOAuthRedirectUri(connectorId: ConnectorId): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new ServiceError("unavailable", "NEXT_PUBLIC_APP_URL not set");
  }
  return `${base.replace(/\/+$/, "")}/api/admin/social/accounts/${connectorId}/callback`;
}

// ── OAuth flow (e.g. LinkedIn direct) ────────────────────────────────────

export async function startConnect(
  actor: ActorLike,
  connectorId: ConnectorId,
): Promise<{ url: string }> {
  ensurePermission(actor, "social.manage");
  const provider = getProvider(connectorId);
  if (!isOAuthConnector(provider)) {
    throw new ServiceError("bad_request", `Connector "${connectorId}" is not an OAuth connector`);
  }
  const state = await buildOAuthState({ connector: connectorId, userId: actor.id, ts: Date.now() });
  return {
    url: provider.buildAuthorizeUrl({
      state,
      redirectUri: getOAuthRedirectUri(connectorId),
    }),
  };
}

export async function completeConnect(params: {
  state: string;
  code: string;
}): Promise<{ count: number }> {
  const decoded = await verifyOAuthState(params.state);
  const provider = getProvider(decoded.connector);
  if (!isOAuthConnector(provider)) {
    throw new ServiceError(
      "bad_request",
      `Connector "${decoded.connector}" is not an OAuth connector`,
    );
  }
  const result = await provider.exchangeCode({
    code: params.code,
    redirectUri: getOAuthRedirectUri(decoded.connector),
  });
  if (result.accounts.length === 0) {
    throw new ServiceError(
      "bad_request",
      "No accounts found for this OAuth grant. Make sure you have an admin role on at least one page.",
    );
  }
  await upsertAccounts({
    connectorId: decoded.connector,
    userId: decoded.userId,
    accounts: result.accounts,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? null,
    expiresAt: result.expiresAt ?? null,
    scopes: result.scopes ?? null,
  });
  return { count: result.accounts.length };
}

// ── API-key flow (e.g. Zernio) ───────────────────────────────────────────

export async function validateApiKey(
  actor: ActorLike,
  connectorId: ConnectorId,
  apiKey: string,
): Promise<OAuthConnectableAccount[]> {
  ensurePermission(actor, "social.manage");
  if (!apiKey || apiKey.length < 8) {
    throw new ServiceError("bad_request", "API key looks too short");
  }
  const provider = getProvider(connectorId);
  if (!isApiKeyConnector(provider)) {
    throw new ServiceError("bad_request", `Connector "${connectorId}" is not an API-key connector`);
  }
  const { accounts } = await provider.validateApiKey(apiKey);
  return accounts;
}

/**
 * Persist the user's chosen accounts under an API key. The key is stored
 * once per account row (shared per chosen account) so disconnecting one
 * doesn't break the others.
 */
export async function saveApiKeyConnection(
  actor: ActorLike,
  connectorId: ConnectorId,
  params: {
    apiKey: string;
    selectedExternalIds: string[];
    /**
     * The full account list returned by validateApiKey — used to look up
     * display names without re-calling the provider. Saves a round-trip.
     */
    candidates: OAuthConnectableAccount[];
  },
): Promise<{ count: number }> {
  ensurePermission(actor, "social.manage");
  const provider = getProvider(connectorId);
  if (!isApiKeyConnector(provider)) {
    throw new ServiceError("bad_request", `Connector "${connectorId}" is not an API-key connector`);
  }
  const chosen = params.candidates.filter((c) => params.selectedExternalIds.includes(c.externalId));
  if (chosen.length === 0) {
    throw new ServiceError("bad_request", "Select at least one account to connect");
  }
  await upsertAccounts({
    connectorId,
    userId: actor.id,
    accounts: chosen,
    accessToken: params.apiKey,
    refreshToken: null,
    expiresAt: null,
    scopes: null,
  });
  return { count: chosen.length };
}

// ── Shared persistence ───────────────────────────────────────────────────

async function upsertAccounts(args: {
  connectorId: ConnectorId;
  userId: string;
  accounts: OAuthConnectableAccount[];
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string | null;
}): Promise<void> {
  const db = await getPrisma();
  for (const account of args.accounts) {
    await db.socialAccount.upsert({
      where: {
        tenantId_connector_externalId: {
          tenantId: await getTenantId(),
          connector: args.connectorId,
          externalId: account.externalId,
        },
      },
      update: {
        platform: account.platform,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scopes: args.scopes,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl ?? null,
        accountType: account.accountType,
        createdById: args.userId,
      },
      create: {
        connector: args.connectorId,
        platform: account.platform,
        externalId: account.externalId,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl ?? null,
        accountType: account.accountType,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scopes: args.scopes,
        createdById: args.userId,
      },
    });
  }
}

// ── Account listing + disconnect ─────────────────────────────────────────

function toSummary(a: {
  id: string;
  platform: string;
  connector: string;
  accountType: string;
  externalId: string;
  displayName: string;
  avatarUrl: string | null;
  expiresAt: Date | null;
}): SocialAccountSummary {
  return {
    id: a.id,
    platform: a.platform as SocialPlatform,
    connector: a.connector as ConnectorId,
    accountType: a.accountType as "organization" | "person",
    externalId: a.externalId,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    isExpired: a.expiresAt ? a.expiresAt.getTime() < Date.now() : false,
  };
}

export async function listAccounts(actor: ActorLike): Promise<SocialAccountSummary[]> {
  ensurePermission(actor, "social.view");
  const db = await getPrisma();
  const rows = await db.socialAccount.findMany({
    orderBy: [{ platform: "asc" }, { connector: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      platform: true,
      connector: true,
      accountType: true,
      externalId: true,
      displayName: true,
      avatarUrl: true,
      expiresAt: true,
    },
  });
  return rows.map(toSummary);
}

export async function disconnectAccount(actor: ActorLike, id: string): Promise<{ success: true }> {
  ensurePermission(actor, "social.manage");
  const db = await getPrisma();
  await db.socialAccount.delete({ where: { id } });
  return { success: true };
}

// ── Publisher resolution ─────────────────────────────────────────────────

/**
 * Resolve a connected account for the publisher: returns the freshest
 * credentials. Only OAuth connectors with refresh tokens get the proactive
 * refresh path; API-key connectors return as-is.
 */
export async function getAccountForPublishing(accountId: string) {
  const db = await getPrisma();
  const account = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new ServiceError("not_found", "Social account not found");

  const provider = getProvider(account.connector as ConnectorId);

  const oneHourFromNow = Date.now() + 60 * 60 * 1000;
  const needsRefresh =
    account.refreshToken && account.expiresAt && account.expiresAt.getTime() < oneHourFromNow;

  if (needsRefresh && provider.refreshToken && account.refreshToken) {
    try {
      const refreshed = await provider.refreshToken(account.refreshToken);
      await db.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? account.refreshToken,
          expiresAt: refreshed.expiresAt ?? null,
          scopes: refreshed.scopes ?? account.scopes,
        },
      });
      return { ...account, accessToken: refreshed.accessToken };
    } catch (err) {
      console.error("[social] token refresh failed:", err);
    }
  }
  return account;
}
