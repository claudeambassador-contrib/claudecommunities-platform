import type { ConnectorId, SocialMediaType, SocialPlatform } from "@/modules/social/types";
import { err, ok, type Result } from "@/shared/http/errors";

const CONNECTORS: readonly ConnectorId[] = ["linkedin", "zernio"];
const PLATFORMS: readonly SocialPlatform[] = ["linkedin"];
const MEDIA_TYPES: readonly SocialMediaType[] = [
  "none",
  "image",
  "multi_image",
  "video",
  "document",
];

export function isStorageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return parsed.pathname.startsWith("/api/files/") || parsed.hostname.endsWith(".r2.dev");
  } catch {
    return false;
  }
}

export function validateConnector(value: string): Result<{ connector: ConnectorId }> {
  if (!CONNECTORS.includes(value as ConnectorId)) {
    return err("bad_request", 400, "Unknown connector");
  }
  return ok({ connector: value as ConnectorId });
}

export function validatePlatform(value: string): Result<{ platform: SocialPlatform }> {
  if (!PLATFORMS.includes(value as SocialPlatform)) {
    return err("bad_request", 400, "Unknown platform");
  }
  return ok({ platform: value as SocialPlatform });
}

export function validateContent(content: string, max: number): Result<{ valid: true }> {
  if (!content) {
    return err("bad_request", 400, "content is required");
  }
  if (content.length > max) {
    return err("bad_request", 400, `content exceeds platform limit (${max} chars)`);
  }
  return ok({ valid: true });
}

export function validateMedia(
  mediaType: SocialMediaType,
  mediaUrls: string[],
): Result<{ valid: true }> {
  if (!MEDIA_TYPES.includes(mediaType)) {
    return err("bad_request", 400, "Invalid mediaType");
  }
  if (mediaType === "none") {
    if (mediaUrls.length > 0) {
      return err("bad_request", 400, "mediaUrls must be empty when mediaType is 'none'");
    }
    return ok({ valid: true });
  }
  if (mediaUrls.length === 0) {
    return err("bad_request", 400, `mediaType '${mediaType}' requires at least one URL`);
  }
  for (const url of mediaUrls) {
    if (!isStorageUrl(url)) {
      return err("bad_request", 400, `Media URL must be a storage URL: ${url}`);
    }
  }
  if (
    (mediaType === "image" || mediaType === "video" || mediaType === "document") &&
    mediaUrls.length !== 1
  ) {
    return err("bad_request", 400, `${mediaType} post must have exactly one media URL`);
  }
  if (mediaType === "multi_image" && mediaUrls.length < 2) {
    return err("bad_request", 400, "multi_image post must have at least 2 media URLs");
  }
  return ok({ valid: true });
}
