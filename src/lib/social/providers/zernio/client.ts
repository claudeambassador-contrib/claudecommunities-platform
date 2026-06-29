/**
 * Raw Zernio REST client. Typed wrappers around the small subset of
 * Zernio endpoints we actually call.
 *
 * Spec: https://docs.zernio.com (OpenAPI at https://zernio.com/openapi.yaml).
 * Auth: `Authorization: Bearer <api-key>` — keys created in Zernio dashboard.
 */

import type { SocialPlatform } from "../../types";

const BASE_URL = process.env.ZERNIO_API_URL || "https://zernio.com/api/v1";

export interface ZernioAccount {
  _id: string;
  platform: string;
  displayName?: string;
  username?: string;
  profileUrl?: string;
  isActive?: boolean;
}

interface ListAccountsResponse {
  accounts: ZernioAccount[];
}

function headers(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Wrap `fetch` with an AbortController so a hanging Zernio response can't
 * burn the entire Worker duration budget. 20s is plenty for /accounts and
 * /posts; if it takes longer than that, something is wrong upstream and
 * the caller should retry rather than wait.
 */
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Zernio request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function listAccounts(
  apiKey: string,
  options: { platform?: SocialPlatform } = {},
): Promise<ZernioAccount[]> {
  const url = new URL(`${BASE_URL}/accounts`);
  if (options.platform) url.searchParams.set("platform", options.platform);
  url.searchParams.set("limit", "100");
  const res = await fetch(url, { headers: headers(apiKey) });
  if (!res.ok) {
    throw new Error(`Zernio /accounts failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as ListAccountsResponse;
  return data.accounts ?? [];
}

export type ZernioMediaType = "image" | "video" | "document";

export interface ZernioMediaItem {
  type: ZernioMediaType;
  url: string;
  title?: string;
}

export interface ZernioCreatePostRequest {
  content: string;
  mediaItems?: ZernioMediaItem[];
  platforms: Array<{
    platform: string;
    accountId: string;
    platformSpecificData?: Record<string, unknown>;
  }>;
  publishNow?: boolean;
  scheduledFor?: string; // ISO timestamp
  timezone?: string;
  /**
   * When true, Zernio stores the post in their dashboard as a draft and
   * does NOT publish it to the destination platform. Useful for end-to-end
   * testing of the publish path without exposing anything publicly.
   */
  isDraft?: boolean;
}

export interface ZernioPostResponse {
  post: {
    _id: string;
    status: string;
    scheduledFor?: string;
    platforms?: Array<{
      platform: string;
      status?: string;
      platformPostUrl?: string;
    }>;
  };
  message?: string;
}

export async function createPost(
  apiKey: string,
  body: ZernioCreatePostRequest,
): Promise<ZernioPostResponse> {
  const res = await fetch(`${BASE_URL}/posts`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Zernio /posts failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as ZernioPostResponse;
}

export interface ZernioUpdatePostRequest {
  content?: string;
  scheduledFor?: string; // ISO timestamp
}

/**
 * Update an existing Zernio post. Per the API, only draft/scheduled/failed/
 * partial posts can be edited. We only ever edit scheduled posts, and only
 * `content` + `scheduledFor` — media changes aren't supported by the PUT
 * endpoint, so the service layer rejects them before reaching here.
 */
export async function updatePost(
  apiKey: string,
  postId: string,
  body: ZernioUpdatePostRequest,
): Promise<ZernioPostResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/posts/${postId}`, {
    method: "PUT",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Zernio PUT /posts/${postId} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as ZernioPostResponse;
}

/**
 * Delete a draft or scheduled Zernio post (cancels the scheduled publish).
 * Idempotent: a 404 means it's already gone, which we treat as success.
 * Published posts can't be deleted via this endpoint.
 */
export async function deletePost(apiKey: string, postId: string): Promise<void> {
  const res = await fetchWithTimeout(`${BASE_URL}/posts/${postId}`, {
    method: "DELETE",
    headers: headers(apiKey),
  });
  if (res.status === 404) return; // already deleted on Zernio's side
  if (!res.ok) {
    throw new Error(`Zernio DELETE /posts/${postId} failed (${res.status}): ${await res.text()}`);
  }
}
