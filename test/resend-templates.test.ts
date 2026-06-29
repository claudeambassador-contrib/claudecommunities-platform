import { describe, expect, it } from "vitest";
import {
  getCampaignEmailHtml,
  getEventReminderEmailHtml,
  getInviteEmailHtml,
  getLumaLinkReadyEmailHtml,
  getNotificationEmailHtml,
  getWelcomeEmailHtml,
} from "@/lib/resend";
import { TENANT_CONFIG_DEFAULTS, type TenantConfig } from "@/lib/tenant-config";

// The 6 resend.ts templates were hand-migrated from module-level region.ts reads
// to a `config: TenantConfig` param (B5). The bug tsc/iso CANNOT catch: on the
// live au tenant `appUrl` and `siteUrl` are byte-identical, so a template that
// reads the wrong field renders identically and the slip is invisible. These
// tests pass DISTINCT site/app URLs so the exact accessor wiring is pinned:
//   - the email logo is built from siteUrl  (logoUrl = `${siteUrl}/images/...`)
//   - every in-app action link is built from appUrl
const SITE = "https://site.example";
const APP = "https://app.example";
const COMMUNITY = "Test Community AB";

const config: TenantConfig = {
  ...TENANT_CONFIG_DEFAULTS,
  siteUrl: SITE,
  appUrl: APP,
  communityName: COMMUNITY,
};

describe("resend.ts templates wire the right tenant config field (appUrl vs siteUrl)", () => {
  it("notification: logo from siteUrl, button + manage-prefs from appUrl", () => {
    const html = getNotificationEmailHtml("Sam", "New reply", "You got a reply", "/posts/1", config);
    expect(html).toContain(`src="${SITE}/images/claude-code-logo.webp"`);
    expect(html).toContain(`href="${APP}/posts/1"`);
    expect(html).toContain(`${APP}/community/settings/notifications`);
    expect(html).toContain(COMMUNITY);
    // the link must resolve against appUrl, never siteUrl
    expect(html).not.toContain(`${SITE}/posts/1`);
  });

  it("welcome: logo from siteUrl, explore CTA from appUrl", () => {
    const html = getWelcomeEmailHtml("Sam", config);
    expect(html).toContain(`src="${SITE}/images/claude-code-logo.webp"`);
    expect(html).toContain(`href="${APP}/community"`);
    expect(html).toContain(COMMUNITY);
  });

  it("invite: logo from siteUrl, join CTA from appUrl, personal message threaded", () => {
    const html = getInviteEmailHtml("Sam", config, "Welcome aboard");
    expect(html).toContain(`src="${SITE}/images/claude-code-logo.webp"`);
    expect(html).toContain(`href="${APP}/login"`);
    expect(html).toContain("Welcome aboard");
    expect(html).toContain(COMMUNITY);
  });

  it("event reminder: event link resolved against appUrl", () => {
    const html = getEventReminderEmailHtml("Sam", "Meetup", "5 March", "Sydney", "evt_9", config);
    expect(html).toContain(`href="${APP}/events/evt_9"`);
    expect(html).not.toContain(`${SITE}/events/evt_9`);
  });

  it("luma-ready: external lumaUrl verbatim, community event link from appUrl", () => {
    const html = getLumaLinkReadyEmailHtml(
      "Sam",
      "Meetup",
      "5 March",
      "https://lu.ma/xyz",
      "evt_9",
      config,
    );
    expect(html).toContain(`href="https://lu.ma/xyz"`);
    expect(html).toContain(`${APP}/events/evt_9`);
    expect(html).toContain(COMMUNITY);
  });

  it("campaign: relative CTA resolves against appUrl, external CTA verbatim, wrapper unsubscribe uses appUrl", () => {
    const relative = getCampaignEmailHtml("Sam", "News", "<p>hi</p>", config, "Read", "/news");
    expect(relative).toContain(`href="${APP}/news"`);
    // the campaign wrapper (wrap.ts) builds its unsubscribe/footer from appUrl
    expect(relative).toContain(`${APP}/community/settings/notifications`);

    const external = getCampaignEmailHtml("Sam", "News", "<p>hi</p>", config, "Read", "https://ext.example/x");
    expect(external).toContain(`href="https://ext.example/x"`);
  });
});
