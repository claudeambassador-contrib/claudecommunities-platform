import type { SocialConnector, SocialPublishResult } from "@/modules/social/types";

const DEFAULT_URL = "https://zernio.com/api/v1";
const TRAILING_SLASH = /\/$/;

export function zernioConnectorFromEnv(env: Record<string, unknown>): SocialConnector | null {
  const apiKey = typeof env.ZERNIO_API_KEY === "string" ? env.ZERNIO_API_KEY.trim() : "";
  if (!apiKey) {
    return null;
  }
  const baseUrl =
    typeof env.ZERNIO_API_URL === "string" && env.ZERNIO_API_URL ? env.ZERNIO_API_URL : DEFAULT_URL;
  return {
    capabilities: { maxTextLength: 3000 },
    id: "zernio",
    publish: async (input) => {
      const response = await fetch(`${baseUrl.replace(TRAILING_SLASH, "")}/posts`, {
        body: JSON.stringify({
          content: input.content,
          mediaItems: input.mediaUrls.map((url) => ({ type: "image", url })),
          platforms: [{ platform: "linkedin" }],
          publishNow: !input.scheduledFor,
          scheduledFor: input.scheduledFor?.toISOString(),
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Zernio publish failed (${response.status}): ${await response.text()}`);
      }
      const body = (await response.json()) as {
        post?: { _id?: string; platforms?: { platformPostUrl?: string }[] };
      };
      const id = body.post?._id;
      if (!id) {
        throw new Error("Zernio publish returned no post id");
      }
      const published: SocialPublishResult = {
        externalId: id,
        externalUrl: body.post?.platforms?.[0]?.platformPostUrl ?? `https://zernio.com/posts/${id}`,
      };
      return published;
    },
    supportsNativeScheduling: true,
  };
}
