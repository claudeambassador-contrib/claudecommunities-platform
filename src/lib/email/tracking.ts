/**
 * Email tracking module — injects tracking pixels, rewrites links for click
 * tracking, and handles unsubscribe URL injection.
 */

// ---------------------------------------------------------------------------
// 1. Tracking pixel
// ---------------------------------------------------------------------------

export function injectTrackingPixel(html: string, sendId: string, baseUrl: string): string {
  const pixelUrl = `${baseUrl}/api/email/track/open/${sendId}`;
  const pixelTag =
    `<img src="${pixelUrl}" width="1" height="1" alt="" ` +
    `style="display:block;width:1px;height:1px;border:0;" />`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixelTag}</body>`);
  }

  // No </body> — just append
  return html + pixelTag;
}

// ---------------------------------------------------------------------------
// 2. Link rewriting for click tracking
// ---------------------------------------------------------------------------

export function rewriteLinks(html: string, sendId: string, baseUrl: string): string {
  // Match href="http(s)://..." inside anchor tags.
  // The regex captures the full href value for http / https URLs.
  const hrefRe = /(<a\b[^>]*?\bhref=")(https?:\/\/[^"]+)(")/gi;

  return html.replace(hrefRe, (_match, prefix: string, url: string, suffix: string) => {
    // Skip mailto: links (shouldn't match the regex, but guard anyway)
    if (url.startsWith("mailto:")) return `${prefix}${url}${suffix}`;

    // Skip anchor-only links
    if (url.startsWith("#")) return `${prefix}${url}${suffix}`;

    // Skip unsubscribe links — they must not be wrapped
    if (url.includes("/api/email/unsubscribe/")) return `${prefix}${url}${suffix}`;

    const encoded = Buffer.from(url).toString("base64url");
    const tracked = `${baseUrl}/api/email/track/click/${sendId}/${encoded}`;
    return `${prefix}${tracked}${suffix}`;
  });
}

// ---------------------------------------------------------------------------
// 3. Unsubscribe URL injection
// ---------------------------------------------------------------------------

export function injectUnsubscribeUrl(
  html: string,
  unsubscribeUrl: string,
): { html: string; headers: Record<string, string> } {
  const updatedHtml = html.replace(/\/community\/settings\/notifications/g, unsubscribeUrl);

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  return { html: updatedHtml, headers };
}

// ---------------------------------------------------------------------------
// 4. Orchestrator
// ---------------------------------------------------------------------------

export interface PrepareOptions {
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export function prepareEmailForSending(
  html: string,
  sendId: string,
  unsubscribeToken: string,
  baseUrl: string,
  options: PrepareOptions = {},
): { html: string; headers: Record<string, string> } {
  let processed = html;

  // Inject the unsubscribe URL first so the link is present before we
  // potentially rewrite other links.
  const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe/${unsubscribeToken}`;
  const { html: withUnsub, headers } = injectUnsubscribeUrl(processed, unsubscribeUrl);
  processed = withUnsub;

  // Click tracking (must run before open-pixel so the pixel img src isn't
  // accidentally rewritten — it's an <img>, not an <a>, so it's safe either
  // way, but ordering keeps intent clear).
  if (options.trackClicks) {
    processed = rewriteLinks(processed, sendId, baseUrl);
  }

  // Open tracking
  if (options.trackOpens) {
    processed = injectTrackingPixel(processed, sendId, baseUrl);
  }

  return { html: processed, headers };
}
