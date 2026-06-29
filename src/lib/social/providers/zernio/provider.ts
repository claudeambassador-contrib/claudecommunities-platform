/**
 * Zernio SocialProvider — posts to any LinkedIn account connected through
 * the Zernio dashboard, using a Zernio API key as the bearer token.
 *
 * Differences from the direct LinkedIn provider:
 *  - No OAuth: the user pastes an API key (created at zernio.com/dashboard).
 *  - LinkedIn account connection happens in Zernio's dashboard, not here.
 *  - Media is referenced by public URL (Zernio fetches it); we don't upload
 *    bytes. The composer's R2 URLs (`/api/files/<key>`) need to be reachable
 *    from the public internet for this to work, which they are.
 */

import type { PlatformCapabilities } from "../../types";
import type {
  ApiKeyValidationResult,
  ProviderPublishRequest,
  ProviderPublishResult,
  SocialProvider,
} from "../types";
import { createPost, deletePost, listAccounts, updatePost, type ZernioMediaItem } from "./client";

// Conservative caps. LinkedIn allows up to 20 images via Zernio; we mirror
// the direct connector's 10-image lid for consistency in the composer.
const LINKEDIN_CAPABILITIES: PlatformCapabilities = {
  text: true,
  singleImage: true,
  multiImage: { supported: true, max: 10 },
  video: true,
  document: true,
  maxTextLength: 3000,
};

/**
 * When ZERNIO_DRY_RUN=true, every publish call is sent with `isDraft: true`
 * — Zernio accepts the request and stores it in its dashboard but does NOT
 * post to LinkedIn. Toggle without redeploying to safely smoke-test the
 * full publish path on staging.
 */
function isDryRun(): boolean {
  const v = process.env.ZERNIO_DRY_RUN;
  return v === "true" || v === "1";
}

function publicAbsoluteUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new Error(
      "Zernio publish requires NEXT_PUBLIC_APP_URL to convert relative media URLs to absolute",
    );
  }
  return `${base.replace(/\/+$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const zernioProvider: SocialProvider = {
  id: "zernio",
  label: "Zernio",
  platforms: ["linkedin"],
  capabilities: { linkedin: LINKEDIN_CAPABILITIES },
  connectKind: "api_key",
  // Zernio has a minute-accurate scheduler — hand scheduled posts off
  // immediately with `scheduledFor` rather than waiting for our cron.
  supportsNativeScheduling: true,

  async validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
    const accounts = await listAccounts(apiKey, { platform: "linkedin" });
    return {
      accounts: accounts.map((a) => ({
        externalId: a._id,
        displayName: a.displayName || a.username || `LinkedIn ${a._id.slice(0, 6)}`,
        // Zernio's accounts list doesn't tell us org vs person directly;
        // assume organization for company-page workflows. Personal-profile
        // posts work the same way through Zernio.
        accountType: "organization",
        avatarUrl: null,
        platform: "linkedin",
      })),
    };
  },

  async publish(req: ProviderPublishRequest): Promise<ProviderPublishResult> {
    const mediaItems: ZernioMediaItem[] = req.media.map((m) => ({
      type:
        req.mediaType === "video" ? "video" : req.mediaType === "document" ? "document" : "image",
      url: publicAbsoluteUrl(m.url),
    }));

    const platformSpecificData: Record<string, unknown> = {};
    if (req.mediaType === "document") {
      // LinkedIn requires a title on document posts; Zernio passes it through.
      platformSpecificData.documentTitle = req.content.slice(0, 60) || "Document";
    }

    const dryRun = isDryRun();

    const response = await createPost(req.account.accessToken, {
      content: req.content,
      mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
      platforms: [
        {
          platform: req.account.platform,
          accountId: req.account.externalId,
          platformSpecificData,
        },
      ],
      // Dry-run forces an isDraft=true call regardless of schedule.
      publishNow: dryRun ? false : !req.scheduledFor,
      scheduledFor: dryRun ? undefined : req.scheduledFor?.toISOString(),
      isDraft: dryRun || undefined,
    });

    const platformPostUrl =
      response.post.platforms?.find((p) => p.platform === req.account.platform)?.platformPostUrl ??
      null;

    return {
      externalId: response.post._id,
      // Fall back to a Zernio dashboard link whenever there's no public
      // platform URL yet — that's the case for dry-run AND for scheduled
      // handoffs (the post hasn't published to LinkedIn yet, so Zernio
      // returns no platformPostUrl). Gives the admin a link to verify either
      // way; an immediate publish still gets the real LinkedIn URL.
      externalUrl: platformPostUrl ?? `https://zernio.com/posts/${response.post._id}`,
    };
  },

  async updateRemote(req): Promise<void> {
    await updatePost(req.accessToken, req.externalId, {
      content: req.content,
      scheduledFor: req.scheduledFor?.toISOString(),
    });
  },

  async deleteRemote(req): Promise<void> {
    await deletePost(req.accessToken, req.externalId);
  },
};
