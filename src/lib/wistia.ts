/**
 * Wistia helpers.
 *
 * The /swatch URL is a low-res blurred placeholder intended for CSS background
 * use while the player loads. For real preview images, fetch the still via
 * Wistia's public oEmbed endpoint.
 */

const SWATCH = (mediaId: string) => `https://fast.wistia.com/embed/medias/${mediaId}/swatch`;

interface WistiaOEmbedResponse {
  thumbnail_url?: string;
  title?: string;
}

/**
 * Returns a high-resolution still image URL for a Wistia video.
 * Falls back to the (blurred) swatch URL if the oEmbed call fails.
 *
 * Result is cached across requests via the Next.js fetch cache.
 */
export async function getWistiaThumbnail(
  mediaId: string,
  width = 1280,
  height = 720,
): Promise<string> {
  try {
    const oembedUrl = `https://fast.wistia.com/oembed?url=${encodeURIComponent(
      `https://fast.wistia.com/medias/${mediaId}`,
    )}&format=json&width=${width}&height=${height}`;

    const res = await fetch(oembedUrl, {
      next: { revalidate: 60 * 60 * 24 }, // 1 day
    });

    if (!res.ok) return SWATCH(mediaId);

    const data: WistiaOEmbedResponse = await res.json();
    if (!data.thumbnail_url) return SWATCH(mediaId);

    // Bump the resize param to the requested size if Wistia returned a smaller
    // crop. The thumbnail_url typically looks like
    //   https://embed-ssl.wistia.com/deliveries/<hash>.jpg?image_crop_resized=200x120
    return data.thumbnail_url.replace(
      /image_crop_resized=\d+x\d+/,
      `image_crop_resized=${width}x${height}`,
    );
  } catch {
    return SWATCH(mediaId);
  }
}
