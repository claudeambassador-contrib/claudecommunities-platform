import { describe, expect, it } from "vitest";
import { blocksToHtml, type EmailBlock, emailLogoUrl, renderCampaignHtml } from "@/lib/email/blocks";
import { wrapEmailContent } from "@/lib/email/wrap";

// These builders used to read region.ts at module load; they now take the
// tenant's URLs as params (B5). The risk tsc/iso can't catch: on au, `siteUrl`
// and `appUrl` are byte-identical, so a wrong-field swap is invisible. These
// tests pass DISTINCT site/app URLs so the exact accessor wiring is pinned:
// blocks/logo must use siteUrl; the email wrapper (unsubscribe/footer) must use
// appUrl.
const SITE = "https://site.example";
const APP = "https://app.example";

describe("email builders take the tenant URL as a param (not region.ts)", () => {
  it("emailLogoUrl is built from siteUrl", () => {
    expect(emailLogoUrl({ siteUrl: SITE })).toBe(`${SITE}/images/claude-code-logo.webp`);
  });

  it("blocksToHtml header logo uses siteUrl, never appUrl", () => {
    const header: EmailBlock = {
      id: "h",
      type: "header",
      props: { title: "Hi", showLogo: true, bgGradient: "#000" },
    };
    const html = blocksToHtml([header], { siteUrl: SITE });
    expect(html).toContain(`${SITE}/images/claude-code-logo.webp`);
    expect(html).not.toContain(APP);
  });

  it("wrapEmailContent footer/unsubscribe links use appUrl, never siteUrl", () => {
    const html = wrapEmailContent("<p>Body</p>", { appUrl: APP });
    expect(html).toContain(`${APP}/community/settings/notifications`);
    expect(html).toContain("<p>Body</p>");
    expect(html).not.toContain(SITE);
  });

  it("renderCampaignHtml threads siteUrl into block rendering", () => {
    const blocksJson = JSON.stringify([
      { type: "header", props: { title: "T", showLogo: true, bgGradient: "#000" } },
    ]);
    const html = renderCampaignHtml("fallback", blocksJson, { siteUrl: SITE });
    expect(html).toContain(`${SITE}/images/claude-code-logo.webp`);
  });

  it("renderCampaignHtml falls back to stored html when blocks are absent", () => {
    expect(renderCampaignHtml("FALLBACK", null, { siteUrl: SITE })).toBe("FALLBACK");
    expect(renderCampaignHtml("FALLBACK", "[]", { siteUrl: SITE })).toBe("FALLBACK");
  });
});
