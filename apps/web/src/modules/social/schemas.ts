import { z } from "zod";

const CONNECTORS = ["linkedin", "zernio"] as const;
const PLATFORMS = ["linkedin"] as const;
const MEDIA_TYPES = ["none", "image", "multi_image", "video", "document"] as const;

function publicR2Host(): string | null {
  try {
    return new URL(process.env.R2_PUBLIC_URL || "").hostname || null;
  } catch {
    return null;
  }
}

export function isStorageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const publicHost = publicR2Host();
    return (
      parsed.pathname.startsWith("/api/files/") ||
      parsed.hostname.endsWith(".r2.dev") ||
      Boolean(publicHost && parsed.hostname === publicHost)
    );
  } catch {
    return false;
  }
}

/** `connectAccount`'s connector rule. */
export const connectorIdInput = z.enum(CONNECTORS, { message: "Unknown connector" });

/** `connectAccount`'s platform rule. */
export const socialPlatformInput = z.enum(PLATFORMS, { message: "Unknown platform" });

/**
 * `createPost`/`updatePost`'s content rule — parameterized on the connector's
 * `maxTextLength` (falls back to the service's default), so it's built per
 * call rather than a static schema, matching the old `validateContent(content, max)`.
 */
export function contentInput(max: number) {
  return z
    .string()
    .min(1, "content is required")
    .max(max, `content exceeds platform limit (${max} chars)`);
}

/**
 * `createPost`/`updatePost`'s media rule — `mediaType` and `mediaUrls` are
 * cross-checked (empty-when-none, storage-url-only, per-type URL counts),
 * so this stays a `superRefine` over both fields together rather than two
 * independent field schemas, matching the old `validateMedia` precedence
 * (each check returns/short-circuits on the first violation).
 */
export const socialMediaInput = z
  .object({
    mediaType: z.enum(MEDIA_TYPES, { message: "Invalid mediaType" }),
    mediaUrls: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    const { mediaType, mediaUrls } = data;
    if (mediaType === "none") {
      if (mediaUrls.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "mediaUrls must be empty when mediaType is 'none'",
        });
      }
      return;
    }
    if (mediaUrls.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `mediaType '${mediaType}' requires at least one URL`,
      });
      return;
    }
    for (const url of mediaUrls) {
      if (!isStorageUrl(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Media URL must be a storage URL: ${url}`,
        });
        return;
      }
    }
    if (
      (mediaType === "image" || mediaType === "video" || mediaType === "document") &&
      mediaUrls.length !== 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${mediaType} post must have exactly one media URL`,
      });
      return;
    }
    if (mediaType === "multi_image" && mediaUrls.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "multi_image post must have at least 2 media URLs",
      });
    }
  });
