/**
 * Raw LinkedIn REST client. No business logic — just typed HTTP calls.
 *
 * Endpoints used:
 *  - OAuth:    https://www.linkedin.com/oauth/v2/{authorization|accessToken}
 *  - Posts:    https://api.linkedin.com/rest/posts
 *  - Images:   https://api.linkedin.com/rest/images?action=initializeUpload
 *  - Videos:   https://api.linkedin.com/rest/videos?action=initializeUpload
 *  - Documents:https://api.linkedin.com/rest/documents?action=initializeUpload
 *  - Org ACLs: https://api.linkedin.com/rest/organizationAcls?q=roleAssignee
 *
 * Spec headers (required on every /rest/ call):
 *   LinkedIn-Version: YYYYMM
 *   X-Restli-Protocol-Version: 2.0.0
 *   Authorization: Bearer {token}
 */

import type { OAuthTokens } from "../types";

/**
 * Subset of an OAuthConnectableAccount that the LinkedIn client can produce
 * without knowing the destination platform — the provider wrapper adds
 * `platform` before exposing it through the SocialProvider interface.
 */
interface LinkedInPageInfo {
  externalId: string;
  displayName: string;
  accountType: "organization" | "person";
  avatarUrl: string | null;
}

/** Pinned version. Bump quarterly to stay within LinkedIn's 12-month window. */
export const LINKEDIN_API_VERSION = "202604";

const AUTHZ_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const REST_BASE = "https://api.linkedin.com/rest";

export interface LinkedInEnv {
  clientId: string;
  clientSecret: string;
}

export const ORG_SCOPES = [
  "r_organization_social",
  "w_organization_social",
  "r_organization_admin",
  "rw_organization_admin",
] as const;

export function buildAuthorizeUrl(
  env: LinkedInEnv,
  params: { state: string; redirectUri: string; scopes?: readonly string[] },
): string {
  const search = new URLSearchParams({
    response_type: "code",
    client_id: env.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: (params.scopes ?? ORG_SCOPES).join(" "),
  });
  return `${AUTHZ_URL}?${search.toString()}`;
}

export async function exchangeAuthorizationCode(
  env: LinkedInEnv,
  params: { code: string; redirectUri: string },
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scopes: data.scope ?? null,
  };
}

export async function refreshAccessToken(
  env: LinkedInEnv,
  refreshToken: string,
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`LinkedIn token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scopes: data.scope ?? null,
  };
}

function restHeaders(accessToken: string, extra: Record<string, string> = {}): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

/**
 * List organizations (company pages) the authenticated member can post to.
 * Requires `rw_organization_admin` or `r_organization_admin`.
 */
export async function listAdministeredOrganizations(
  accessToken: string,
): Promise<LinkedInPageInfo[]> {
  // organizationAcls returns roleAssignment -> organization URN. We then
  // fetch each organization's name + logo.
  const aclUrl = `${REST_BASE}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50`;
  const aclRes = await fetch(aclUrl, { headers: restHeaders(accessToken) });
  if (!aclRes.ok) {
    throw new Error(`organizationAcls failed (${aclRes.status}): ${await aclRes.text()}`);
  }
  const aclData = (await aclRes.json()) as {
    elements?: Array<{ organization?: string }>;
  };
  const orgUrns = (aclData.elements ?? [])
    .map((e) => e.organization)
    .filter((u): u is string => typeof u === "string");
  if (orgUrns.length === 0) return [];

  // Fetch org details in parallel. URL-encode the URN.
  const accounts = await Promise.all(
    orgUrns.map(async (urn) => {
      const id = urn.replace("urn:li:organization:", "");
      const orgRes = await fetch(`${REST_BASE}/organizations/${encodeURIComponent(id)}`, {
        headers: restHeaders(accessToken),
      });
      if (!orgRes.ok) {
        return {
          externalId: id,
          displayName: `Organization ${id}`,
          accountType: "organization" as const,
          avatarUrl: null,
        };
      }
      const org = (await orgRes.json()) as {
        localizedName?: string;
        name?: { localized?: Record<string, string> };
        logoV2?: { original?: string };
      };
      return {
        externalId: id,
        displayName:
          org.localizedName ?? Object.values(org.name?.localized ?? {})[0] ?? `Organization ${id}`,
        accountType: "organization" as const,
        avatarUrl: null,
      };
    }),
  );
  return accounts;
}

// ── Media upload helpers ────────────────────────────────────────────────

interface InitImageUploadResponse {
  value: {
    uploadUrl: string;
    image: string; // URN
  };
}

export async function uploadImage(
  accessToken: string,
  ownerUrn: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const initRes = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!initRes.ok) {
    throw new Error(`image initializeUpload failed (${initRes.status}): ${await initRes.text()}`);
  }
  const { value } = (await initRes.json()) as InitImageUploadResponse;
  const putRes = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`image PUT failed (${putRes.status}): ${await putRes.text()}`);
  }
  return value.image;
}

interface InitDocumentUploadResponse {
  value: { uploadUrl: string; document: string };
}

export async function uploadDocument(
  accessToken: string,
  ownerUrn: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const initRes = await fetch(`${REST_BASE}/documents?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!initRes.ok) {
    throw new Error(
      `document initializeUpload failed (${initRes.status}): ${await initRes.text()}`,
    );
  }
  const { value } = (await initRes.json()) as InitDocumentUploadResponse;
  const putRes = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`document PUT failed (${putRes.status}): ${await putRes.text()}`);
  }
  return value.document;
}

interface InitVideoUploadResponse {
  value: {
    video: string;
    uploadInstructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }>;
    uploadToken?: string;
  };
}

/**
 * LinkedIn's videos API supports multipart chunked uploads. For files up to
 * the single-part limit (~200MB), one upload instruction covers it. We
 * implement single-instruction and reject multi-part for v1 — anything
 * bigger gets rejected by the size cap upstream.
 */
export async function uploadVideo(
  accessToken: string,
  ownerUrn: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const initRes = await fetch(`${REST_BASE}/videos?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes: bytes.byteLength,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!initRes.ok) {
    throw new Error(`video initializeUpload failed (${initRes.status}): ${await initRes.text()}`);
  }
  const { value } = (await initRes.json()) as InitVideoUploadResponse;
  if (value.uploadInstructions.length !== 1) {
    throw new Error(
      `video too large for v1 single-part upload (${value.uploadInstructions.length} parts)`,
    );
  }
  const part = value.uploadInstructions[0];
  const putRes = await fetch(part.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`video PUT failed (${putRes.status}): ${await putRes.text()}`);
  }
  const etag = putRes.headers.get("etag");
  // Finalize upload — required to flip the video from PROCESSING to AVAILABLE.
  const finalizeRes = await fetch(`${REST_BASE}/videos?action=finalizeUpload`, {
    method: "POST",
    headers: restHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: value.video,
        uploadToken: value.uploadToken ?? "",
        uploadedPartIds: etag ? [etag.replace(/"/g, "")] : [],
      },
    }),
  });
  if (!finalizeRes.ok) {
    throw new Error(
      `video finalizeUpload failed (${finalizeRes.status}): ${await finalizeRes.text()}`,
    );
  }
  return value.video;
}

// ── Post creation ────────────────────────────────────────────────────────

interface PostCommon {
  author: string; // URN
  commentary: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
  lifecycleState?: "PUBLISHED" | "DRAFT";
  isReshareDisabledByAuthor?: boolean;
}

function baseDistribution() {
  return {
    feedDistribution: "MAIN_FEED" as const,
    targetEntities: [] as unknown[],
    thirdPartyDistributionChannels: [] as unknown[],
  };
}

function buildAuthor(accountType: "organization" | "person", externalId: string): string {
  return accountType === "organization"
    ? `urn:li:organization:${externalId}`
    : `urn:li:person:${externalId}`;
}

async function createPost(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ externalId: string; externalUrl: string | null }> {
  const res = await fetch(`${REST_BASE}/posts`, {
    method: "POST",
    headers: restHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`posts create failed (${res.status}): ${await res.text()}`);
  }
  const urn = res.headers.get("x-restli-id");
  if (!urn) {
    throw new Error("posts create succeeded but x-restli-id header was missing");
  }
  return {
    externalId: urn,
    // Both ugcPost and share URNs work in this URL format.
    externalUrl: `https://www.linkedin.com/feed/update/${urn}/`,
  };
}

export interface CreatePostArgs {
  accessToken: string;
  accountType: "organization" | "person";
  externalId: string;
  content: string;
}

export function postText(args: CreatePostArgs) {
  const author = buildAuthor(args.accountType, args.externalId);
  return createPost(args.accessToken, {
    author,
    commentary: args.content,
    visibility: "PUBLIC",
    distribution: baseDistribution(),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  } satisfies PostCommon & Record<string, unknown>);
}

export function postWithImage(args: CreatePostArgs & { imageUrn: string; altText?: string }) {
  const author = buildAuthor(args.accountType, args.externalId);
  return createPost(args.accessToken, {
    author,
    commentary: args.content,
    visibility: "PUBLIC",
    distribution: baseDistribution(),
    content: {
      media: {
        id: args.imageUrn,
        ...(args.altText ? { altText: args.altText } : {}),
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
}

export function postWithMultiImage(args: CreatePostArgs & { imageUrns: string[] }) {
  const author = buildAuthor(args.accountType, args.externalId);
  return createPost(args.accessToken, {
    author,
    commentary: args.content,
    visibility: "PUBLIC",
    distribution: baseDistribution(),
    content: {
      multiImage: {
        images: args.imageUrns.map((id) => ({ id })),
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
}

export function postWithVideo(args: CreatePostArgs & { videoUrn: string; title?: string }) {
  const author = buildAuthor(args.accountType, args.externalId);
  return createPost(args.accessToken, {
    author,
    commentary: args.content,
    visibility: "PUBLIC",
    distribution: baseDistribution(),
    content: {
      media: { id: args.videoUrn, ...(args.title ? { title: args.title } : {}) },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
}

export function postWithDocument(args: CreatePostArgs & { documentUrn: string; title: string }) {
  const author = buildAuthor(args.accountType, args.externalId);
  return createPost(args.accessToken, {
    author,
    commentary: args.content,
    visibility: "PUBLIC",
    distribution: baseDistribution(),
    content: {
      media: { id: args.documentUrn, title: args.title },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
}
