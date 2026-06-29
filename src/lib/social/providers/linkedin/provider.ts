/**
 * LinkedIn SocialProvider implementation. Translates from the platform-agnostic
 * provider contract into LinkedIn REST calls. All HTTP lives in ./client.ts.
 */

import type { PlatformCapabilities } from "../../types";
import type {
  OAuthExchangeResult,
  OAuthTokens,
  ProviderPublishRequest,
  ProviderPublishResult,
  SocialProvider,
} from "../types";
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  type LinkedInEnv,
  listAdministeredOrganizations,
  postText,
  postWithDocument,
  postWithImage,
  postWithMultiImage,
  postWithVideo,
  refreshAccessToken,
  uploadDocument,
  uploadImage,
  uploadVideo,
} from "./client";

const LINKEDIN_CAPABILITIES: PlatformCapabilities = {
  text: true,
  singleImage: true,
  // LinkedIn MultiImage caps at 20 images per post; we expose 10 for sanity.
  multiImage: { supported: true, max: 10 },
  video: true,
  document: true, // swipeable "carousel" experience via PDF document post
  maxTextLength: 3000,
};

function readEnv(): LinkedInEnv {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "LinkedIn provider is not configured — set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret };
}

async function fetchBytes(item: { url: string; bytes?: ArrayBuffer }): Promise<ArrayBuffer> {
  if (item.bytes) return item.bytes;
  // Allow relative /api/files/<key> URLs by resolving against the app's base URL.
  const url = item.url.startsWith("/")
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${item.url}`
    : item.url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch media ${item.url} (${res.status})`);
  return res.arrayBuffer();
}

export const linkedInProvider: SocialProvider = {
  id: "linkedin",
  label: "LinkedIn (direct)",
  platforms: ["linkedin"],
  capabilities: { linkedin: LINKEDIN_CAPABILITIES },
  connectKind: "oauth",
  // Direct LinkedIn has no scheduling API — our cron drives the timing.
  supportsNativeScheduling: false,

  buildAuthorizeUrl({ state, redirectUri }) {
    return buildAuthorizeUrl(readEnv(), { state, redirectUri });
  },

  async exchangeCode({ code, redirectUri }): Promise<OAuthExchangeResult> {
    const env = readEnv();
    const tokens = await exchangeAuthorizationCode(env, { code, redirectUri });
    const accounts = await listAdministeredOrganizations(tokens.accessToken);
    return {
      ...tokens,
      accounts: accounts.map((a) => ({ ...a, platform: "linkedin" as const })),
    };
  },

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    return refreshAccessToken(readEnv(), refreshToken);
  },

  async publish(req: ProviderPublishRequest): Promise<ProviderPublishResult> {
    const author =
      req.account.accountType === "organization"
        ? `urn:li:organization:${req.account.externalId}`
        : `urn:li:person:${req.account.externalId}`;

    const baseArgs = {
      accessToken: req.account.accessToken,
      accountType: req.account.accountType,
      externalId: req.account.externalId,
      content: req.content,
    };

    switch (req.mediaType) {
      case "none":
        return postText(baseArgs);

      case "image": {
        if (req.media.length === 0) throw new Error("image post requires 1 media item");
        const bytes = await fetchBytes(req.media[0]);
        const imageUrn = await uploadImage(req.account.accessToken, author, bytes);
        return postWithImage({ ...baseArgs, imageUrn });
      }

      case "multi_image": {
        if (req.media.length < 2) {
          throw new Error("multi_image post requires at least 2 media items");
        }
        if (req.media.length > LINKEDIN_CAPABILITIES.multiImage.max) {
          throw new Error(
            `multi_image post supports up to ${LINKEDIN_CAPABILITIES.multiImage.max} items`,
          );
        }
        const imageUrns = await Promise.all(
          req.media.map(async (m) => {
            const bytes = await fetchBytes(m);
            return uploadImage(req.account.accessToken, author, bytes);
          }),
        );
        return postWithMultiImage({ ...baseArgs, imageUrns });
      }

      case "video": {
        if (req.media.length === 0) throw new Error("video post requires 1 media item");
        const bytes = await fetchBytes(req.media[0]);
        const videoUrn = await uploadVideo(req.account.accessToken, author, bytes);
        return postWithVideo({ ...baseArgs, videoUrn });
      }

      case "document": {
        if (req.media.length === 0) throw new Error("document post requires 1 PDF media item");
        const bytes = await fetchBytes(req.media[0]);
        const documentUrn = await uploadDocument(req.account.accessToken, author, bytes);
        // The title is required on document posts; LinkedIn shows it as the
        // document name. Fall back to a short slice of the commentary.
        const title = req.content.slice(0, 60) || "Document";
        return postWithDocument({ ...baseArgs, documentUrn, title });
      }
    }
  },
};
