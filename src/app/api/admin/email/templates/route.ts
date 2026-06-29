import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantConfig } from "@/lib/tenant-config";

// Starter template presets — seeded on first fetch if DB is empty
function buildStarterTemplates(SITE_URL: string) {
  return [
    {
      name: "Community Newsletter",
      description:
        "Rich monthly newsletter with featured content, two-column highlights, and social footer",
      category: "newsletter",
      blocks: JSON.stringify([
        {
          type: "header",
          props: {
            title: "The Claude Digest",
            subtitle: "Your monthly roundup of community highlights, tips & events",
            showLogo: true,
            bgGradient: "linear-gradient(135deg, #D4836A 0%, #B85C4A 50%, #8B4513 100%)",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "text",
          props: {
            content:
              "Hey {{name}},\n\nAnother incredible month in the community! Here's what you might have missed — and what's coming up next.",
            fontSize: 16,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "divider",
          props: { color: "rgba(212,131,106,0.3)", width: "100%", thickness: 2, style: "solid" },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "text",
          props: { content: "Featured This Month", fontSize: 20, color: "#D4836A", align: "left" },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "image",
          props: {
            src: "",
            alt: "Featured article or project screenshot",
            link: "",
            width: "100%",
            align: "center",
            borderRadius: 12,
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "text",
          props: {
            content:
              "Highlight your top community story here. What shipped this month? What conversation sparked the most engagement? What did members build with Claude?",
            fontSize: 15,
            color: "#E7E5E4",
            align: "left",
          },
        },
        {
          type: "button",
          props: {
            text: "Read the Full Story",
            url: `${SITE_URL}/community`,
            bgColor: "#D4836A",
            textColor: "#ffffff",
            align: "left",
            borderRadius: 8,
            fullWidth: false,
          },
        },
        { type: "spacer", props: { height: 28 } },
        {
          type: "divider",
          props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "text",
          props: { content: "Quick Links", fontSize: 18, color: "#D4836A", align: "left" },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "columns",
          props: {
            leftContent:
              "Latest Course\nMaster Claude Code in 30 days — our most popular course just got a major update with new lessons on MCP servers.",
            rightContent:
              "Upcoming Event\nSydney Meetup — April 15th. Join us for demos, lightning talks, and networking over drinks.",
            leftImage: "",
            rightImage: "",
            ratio: "50-50",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "divider",
          props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "text",
          props: {
            content: "See you in the community,\nThe Claude Community Team",
            fontSize: 14,
            color: "#A8A29E",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "social",
          props: {
            align: "center",
            links: [
              { platform: "Community", url: `${SITE_URL}/community` },
              { platform: "Events", url: `${SITE_URL}/events` },
              { platform: "LinkedIn", url: "https://linkedin.com" },
            ],
          },
        },
      ]),
      html: "",
    },
    {
      name: "Event Invitation",
      description:
        "Vibrant event invite with schedule details, speaker spotlight, and prominent RSVP",
      category: "event",
      blocks: JSON.stringify([
        {
          type: "header",
          props: {
            title: "You're Invited",
            subtitle: "An exclusive evening with the Claude Community",
            showLogo: true,
            bgGradient: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #2563EB 100%)",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "text",
          props: {
            content:
              "Hey {{name}},\n\nWe'd love to have you at our next event. It's going to be a great one.",
            fontSize: 16,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "columns",
          props: {
            leftContent: "When\nThursday, April 10th\n6:00 PM — 8:30 PM AEST",
            rightContent: "Where\nWorkshop 17, Barangaroo\nSydney CBD",
            leftImage: "",
            rightImage: "",
            ratio: "50-50",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "button",
          props: {
            text: "Reserve Your Spot",
            url: `${SITE_URL}/events`,
            bgColor: "#7C3AED",
            textColor: "#ffffff",
            align: "center",
            borderRadius: 12,
            fullWidth: true,
          },
        },
        { type: "spacer", props: { height: 28 } },
        {
          type: "divider",
          props: { color: "rgba(124,58,237,0.3)", width: "100%", thickness: 2, style: "solid" },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "text",
          props: { content: "What's on the Agenda", fontSize: 18, color: "#A78BFA", align: "left" },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "text",
          props: {
            content:
              "6:00 PM — Doors open, drinks & networking\n6:30 PM — Lightning talks: 3 members share what they've built\n7:15 PM — Live demo: Building with Claude Code & MCP\n8:00 PM — Open Q&A and more networking\n8:30 PM — Wrap up",
            fontSize: 15,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "divider",
          props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "text",
          props: {
            content:
              "Spots are limited — RSVP early to guarantee your place.\n\nSee you there,\nThe Claude Community Team",
            fontSize: 14,
            color: "#A8A29E",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "social",
          props: {
            align: "center",
            links: [
              { platform: "Events", url: `${SITE_URL}/events` },
              { platform: "Community", url: `${SITE_URL}/community` },
            ],
          },
        },
      ]),
      html: "",
    },
    {
      name: "Welcome Email",
      description: "Warm onboarding welcome with clear next steps and community highlights",
      category: "welcome",
      blocks: JSON.stringify([
        {
          type: "header",
          props: {
            title: "Welcome to Claude Community!",
            subtitle: "You just joined 400+ builders, creators & AI enthusiasts",
            showLogo: true,
            bgGradient: "linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "text",
          props: {
            content:
              "Hey {{name}},\n\nWelcome aboard! We're stoked to have you here.\n\nClaude Community is where people who build with Claude come to learn, share, and connect. Whether you're writing your first prompt or shipping production AI apps — you're in the right place.",
            fontSize: 16,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "divider",
          props: { color: "rgba(16,185,129,0.3)", width: "100%", thickness: 2, style: "solid" },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "text",
          props: {
            content: "Your First Three Moves",
            fontSize: 18,
            color: "#34D399",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "columns",
          props: {
            leftContent:
              "1. Complete Your Profile\nAdd a photo, bio, and your interests so other members can find and connect with you.",
            rightContent:
              "2. Say Hello\nDrop an intro post in the community feed — tell us what you're working on or what you're curious about.",
            leftImage: "",
            rightImage: "",
            ratio: "50-50",
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "text",
          props: {
            content:
              "3. Explore Courses & Events\nWe run hands-on workshops and self-paced courses on Claude Code, prompt engineering, MCP servers, and more. Check what's coming up.",
            fontSize: 15,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "button",
          props: {
            text: "Jump Into the Community",
            url: `${SITE_URL}/community`,
            bgColor: "#10B981",
            textColor: "#ffffff",
            align: "center",
            borderRadius: 12,
            fullWidth: true,
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "divider",
          props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "text",
          props: {
            content:
              "Questions? Just hit reply — a real human reads every message.\n\nCheers,\nRye & the Claude Community Team",
            fontSize: 14,
            color: "#A8A29E",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "social",
          props: {
            align: "center",
            links: [
              { platform: "Community", url: `${SITE_URL}/community` },
              { platform: "Courses", url: `${SITE_URL}/courses` },
              { platform: "Events", url: `${SITE_URL}/events` },
            ],
          },
        },
      ]),
      html: "",
    },
    {
      name: "Product Launch",
      description: "High-impact announcement with hero image, feature highlights, and strong CTA",
      category: "announcement",
      blocks: JSON.stringify([
        {
          type: "header",
          props: {
            title: "Something Big Just Dropped",
            subtitle: "A new way to build with Claude",
            showLogo: true,
            bgGradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #EC4899 100%)",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "text",
          props: {
            content:
              "Hey {{name}},\n\nWe've been working on something special — and today it's live.",
            fontSize: 16,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "image",
          props: {
            src: "",
            alt: "Product screenshot or hero image",
            link: "",
            width: "100%",
            align: "center",
            borderRadius: 12,
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "text",
          props: { content: "What's New", fontSize: 20, color: "#FBBF24", align: "left" },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "text",
          props: {
            content:
              "Describe the key change or new feature here. Focus on what it means for your members — not just what it does, but why it matters and how it makes their life better.",
            fontSize: 15,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "columns",
          props: {
            leftContent:
              "Faster Workflows\nGet things done in half the time with the new streamlined interface.",
            rightContent:
              "Better Results\nSmarter defaults and improved AI suggestions mean higher quality output.",
            leftImage: "",
            rightImage: "",
            ratio: "50-50",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "button",
          props: {
            text: "Try It Now",
            url: `${SITE_URL}`,
            bgColor: "#F59E0B",
            textColor: "#1C1917",
            align: "center",
            borderRadius: 12,
            fullWidth: true,
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "divider",
          props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "text",
          props: {
            content:
              "Questions or feedback? We're all ears — just reply to this email.\n\nThe Claude Community Team",
            fontSize: 14,
            color: "#A8A29E",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "social",
          props: {
            align: "center",
            links: [
              { platform: "Website", url: `${SITE_URL}` },
              { platform: "LinkedIn", url: "https://linkedin.com" },
            ],
          },
        },
      ]),
      html: "",
    },
    {
      name: "Re-engagement",
      description:
        "Win back inactive members with a personal touch and compelling reason to return",
      category: "custom",
      blocks: JSON.stringify([
        {
          type: "header",
          props: {
            title: "We Miss You, {{name}}",
            subtitle: "A lot has changed since you last visited",
            showLogo: true,
            bgGradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A78BFA 100%)",
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "text",
          props: {
            content:
              "Hey {{name}},\n\nIt's been a while! The community has been buzzing and we wanted to make sure you don't miss out.\n\nHere's a quick look at what's happened since your last visit:",
            fontSize: 16,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "text",
          props: { content: "What You've Missed", fontSize: 18, color: "#A78BFA", align: "left" },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "text",
          props: {
            content:
              "New courses on Claude Code, MCP servers, and agent building\n\nMonthly meetups in Sydney, Melbourne & online\n\n50+ new members sharing projects and insights\n\nFresh resources, templates, and community tools",
            fontSize: 15,
            color: "#E7E5E4",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 20 } },
        {
          type: "button",
          props: {
            text: "Come Say Hello Again",
            url: `${SITE_URL}/community`,
            bgColor: "#8B5CF6",
            textColor: "#ffffff",
            align: "center",
            borderRadius: 12,
            fullWidth: true,
          },
        },
        { type: "spacer", props: { height: 24 } },
        {
          type: "divider",
          props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
        },
        { type: "spacer", props: { height: 16 } },
        {
          type: "text",
          props: {
            content:
              "No pressure — but we'd love to see you back.\n\nCheers,\nThe Claude Community Team",
            fontSize: 14,
            color: "#A8A29E",
            align: "left",
          },
        },
        { type: "spacer", props: { height: 12 } },
        {
          type: "social",
          props: {
            align: "center",
            links: [
              { platform: "Community", url: `${SITE_URL}/community` },
              { platform: "Events", url: `${SITE_URL}/events` },
            ],
          },
        },
      ]),
      html: "",
    },
    // ── HTML-based premium templates ──────────────────────────────────
    (() => {
      const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;">
  <!-- Gradient Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#D4836A 0%,#B85C4A 40%,#7C3A2A 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px 40px;text-align:center;">
      <img src="${SITE_URL}/images/claude-code-logo.webp" alt="Claude Community" width="52" height="52" style="display:block;margin:0 auto 20px auto;border-radius:12px;" />
      <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">The Claude Digest</h1>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:rgba(255,255,255,0.85);">Premium insights for the Claude Community</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#1C1917;padding:0;">
      <!-- Greeting -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;">
            <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#E7E5E4;line-height:1.6;">Hey {{name}},</p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#A8A29E;line-height:1.6;">Here's your curated roundup of what's happening in the community this month. Grab a coffee and dig in.</p>
          </td>
        </tr>
      </table>
      <!-- Featured Section -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2D2926;border-radius:12px;border:1px solid rgba(212,131,106,0.25);">
              <tr>
                <td style="padding:24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-bottom:12px;">
                        <span style="display:inline-block;background:rgba(212,131,106,0.15);color:#D4836A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:4px 10px;border-radius:6px;">&#9733; Featured</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <h2 style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:700;color:#E7E5E4;">This Month's Top Story</h2>
                        <p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#A8A29E;line-height:1.6;">Highlight your flagship article, project showcase, or community milestone here. What made this month special? Tell the story that got everyone talking.</p>
                        <a href="${SITE_URL}/community" style="display:inline-block;background:#D4836A;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">Read More &#8594;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Quick Links 2-Column -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <h3 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#D4836A;">Quick Links</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48%" valign="top" style="background:#2D2926;border-radius:10px;border:1px solid rgba(255,255,255,0.06);padding:20px;">
                  <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;">&#128218;</p>
                  <h4 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:#E7E5E4;">Latest Course</h4>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A8A29E;line-height:1.5;">Master Claude Code in 30 days with hands-on projects and real-world scenarios.</p>
                </td>
                <td width="4%"></td>
                <td width="48%" valign="top" style="background:#2D2926;border-radius:10px;border:1px solid rgba(255,255,255,0.06);padding:20px;">
                  <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;">&#127879;</p>
                  <h4 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:#E7E5E4;">Upcoming Event</h4>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A8A29E;line-height:1.5;">Sydney Meetup next month. Demos, talks, and networking over drinks.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Top Stories -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <h3 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#D4836A;">Top Stories This Month</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="36" valign="top"><span style="display:inline-block;width:28px;height:28px;background:rgba(212,131,106,0.15);color:#D4836A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;text-align:center;line-height:28px;border-radius:8px;">1</span></td>
                    <td valign="top"><p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;line-height:1.5;"><strong>Community project of the month</strong> &#8212; A member-built tool that's changing workflows</p></td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="36" valign="top"><span style="display:inline-block;width:28px;height:28px;background:rgba(212,131,106,0.15);color:#D4836A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;text-align:center;line-height:28px;border-radius:8px;">2</span></td>
                    <td valign="top"><p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;line-height:1.5;"><strong>New MCP server integrations</strong> &#8212; Connect Claude to your favourite tools</p></td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="36" valign="top"><span style="display:inline-block;width:28px;height:28px;background:rgba(212,131,106,0.15);color:#D4836A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;text-align:center;line-height:28px;border-radius:8px;">3</span></td>
                    <td valign="top"><p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;line-height:1.5;"><strong>Tips &amp; tricks roundup</strong> &#8212; The best prompts and patterns shared this month</p></td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;text-align:center;">
            <a href="${SITE_URL}/community" style="display:inline-block;background:linear-gradient(135deg,#D4836A,#B85C4A);color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;">Visit the Community &#8594;</a>
          </td>
        </tr>
      </table>
      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:32px 40px 0 40px;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
      </table>
      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 40px 32px 40px;text-align:center;">
            <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#78716C;line-height:1.5;">You're receiving this because you're part of the Claude Community.</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="padding:0 8px;"><a href="${SITE_URL}/community" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#D4836A;text-decoration:none;">Community</a></td>
                <td style="color:#78716C;">&#8226;</td>
                <td style="padding:0 8px;"><a href="${SITE_URL}/events" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#D4836A;text-decoration:none;">Events</a></td>
                <td style="color:#78716C;">&#8226;</td>
                <td style="padding:0 8px;"><a href="${SITE_URL}/courses" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#D4836A;text-decoration:none;">Courses</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      return {
        name: "Premium Newsletter",
        description:
          "Visually rich HTML newsletter with gradient header, featured card, 2-column quick links, numbered stories, and dark footer",
        category: "newsletter",
        blocks: JSON.stringify([{ type: "html", props: { code: html } }]),
        html,
      };
    })(),
    (() => {
      const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;">
  <!-- Gradient Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#7C3AED 0%,#4F46E5 50%,#2563EB 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px 40px;text-align:center;">
      <img src="${SITE_URL}/images/claude-code-logo.webp" alt="Claude Community" width="48" height="48" style="display:block;margin:0 auto 20px auto;border-radius:12px;" />
      <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);">You're Invited</p>
      <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Workshop: Build with Claude Code</h1>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:rgba(255,255,255,0.8);">A hands-on evening of learning, demos &amp; community</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#1C1917;padding:0;">
      <!-- Greeting -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#E7E5E4;line-height:1.6;">Hey {{name}},</p>
            <p style="margin:12px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#A8A29E;line-height:1.6;">We'd love to have you at our next workshop. Here are the details:</p>
          </td>
        </tr>
      </table>
      <!-- Event Details Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 40px 0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2D2926;border-radius:12px;border:1px solid rgba(124,58,237,0.25);">
              <tr>
                <td style="padding:24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="33%" valign="top" style="padding-right:12px;">
                        <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;">&#128197;</p>
                        <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#A78BFA;">Date</p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#E7E5E4;">Thu, April 10</p>
                      </td>
                      <td width="33%" valign="top" style="padding:0 6px;">
                        <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;">&#9200;</p>
                        <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#A78BFA;">Time</p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#E7E5E4;">6:00 &#8211; 8:30 PM</p>
                      </td>
                      <td width="33%" valign="top" style="padding-left:12px;">
                        <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;">&#128205;</p>
                        <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#A78BFA;">Location</p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#E7E5E4;">Workshop 17, Sydney</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Speaker Spotlight -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <h3 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#A78BFA;">Speaker Spotlight</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2D2926;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
              <tr>
                <td width="80" valign="top" style="padding:20px;">
                  <div style="width:56px;height:56px;background:linear-gradient(135deg,#7C3AED,#2563EB);border-radius:50%;text-align:center;line-height:56px;font-size:24px;">&#128104;&#8205;&#128187;</div>
                </td>
                <td valign="top" style="padding:20px 20px 20px 0;">
                  <h4 style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;color:#E7E5E4;">Featured Speaker Name</h4>
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A78BFA;font-weight:600;">Role / Company</p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#A8A29E;line-height:1.5;">Brief bio or talk description. What will attendees learn? Why is this session unmissable?</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Agenda Timeline -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <h3 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#A78BFA;">Agenda</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:10px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="14" valign="top" style="padding-top:5px;"><div style="width:10px;height:10px;background:#7C3AED;border-radius:50%;"></div></td>
                    <td width="12"></td>
                    <td style="border-left:2px solid rgba(124,58,237,0.3);padding-left:16px;padding-bottom:12px;">
                      <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:#A78BFA;">6:00 PM</p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;">Doors open &#8212; drinks &amp; networking</p>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="14" valign="top" style="padding-top:5px;"><div style="width:10px;height:10px;background:#4F46E5;border-radius:50%;"></div></td>
                    <td width="12"></td>
                    <td style="border-left:2px solid rgba(124,58,237,0.3);padding-left:16px;padding-bottom:12px;">
                      <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:#A78BFA;">6:30 PM</p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;">Lightning talks &#8212; 3 members share what they've built</p>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="14" valign="top" style="padding-top:5px;"><div style="width:10px;height:10px;background:#2563EB;border-radius:50%;"></div></td>
                    <td width="12"></td>
                    <td style="border-left:2px solid rgba(124,58,237,0.3);padding-left:16px;padding-bottom:12px;">
                      <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:#A78BFA;">7:15 PM</p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;">Live demo &#8212; Building with Claude Code &amp; MCP</p>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="14" valign="top" style="padding-top:5px;"><div style="width:10px;height:10px;background:#7C3AED;border-radius:50%;"></div></td>
                    <td width="12"></td>
                    <td style="padding-left:16px;">
                      <p style="margin:0 0 2px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:#A78BFA;">8:00 PM</p>
                      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#E7E5E4;">Open Q&amp;A and networking until 8:30 PM</p>
                    </td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- RSVP Button -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;text-align:center;">
            <a href="${SITE_URL}/events" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#2563EB);color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:17px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:12px;letter-spacing:0.3px;">RSVP Now &#8594;</a>
            <p style="margin:12px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#78716C;">Spots are limited &#8212; reserve yours today</p>
          </td>
        </tr>
      </table>
      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:32px 40px 0 40px;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
      </table>
      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 40px 32px 40px;text-align:center;">
            <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#A8A29E;">See you there,<br/>The Claude Community Team</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="padding:0 8px;"><a href="${SITE_URL}/events" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A78BFA;text-decoration:none;">Events</a></td>
                <td style="color:#78716C;">&#8226;</td>
                <td style="padding:0 8px;"><a href="${SITE_URL}/community" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A78BFA;text-decoration:none;">Community</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      return {
        name: "Workshop Invite",
        description:
          "Striking event invitation with gradient header, event details card, speaker spotlight, visual agenda timeline, and prominent RSVP",
        category: "event",
        blocks: JSON.stringify([{ type: "html", props: { code: html } }]),
        html,
      };
    })(),
    (() => {
      const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;">
  <!-- Gradient Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#F59E0B 0%,#EF4444 50%,#D4836A 100%);border-radius:16px 16px 0 0;padding:48px 40px 40px 40px;text-align:center;">
      <img src="${SITE_URL}/images/claude-code-logo.webp" alt="Claude Community" width="48" height="48" style="display:block;margin:0 auto 20px auto;border-radius:12px;" />
      <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);">Product Update</p>
      <h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">What's New This Month</h1>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:rgba(255,255,255,0.85);">Fresh features, improvements &amp; what's coming next</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#1C1917;padding:0;">
      <!-- Hero Section -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;">
            <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#E7E5E4;line-height:1.6;">Hey {{name}},</p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;color:#A8A29E;line-height:1.6;">We've been shipping fast this month. Here's a look at the biggest updates and why they matter for how you build with Claude.</p>
          </td>
        </tr>
      </table>
      <!-- Hero Feature Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 40px 0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(212,131,106,0.1));border-radius:12px;border:1px solid rgba(245,158,11,0.2);">
              <tr>
                <td style="padding:28px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;">&#128640;</p>
                  <h2 style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:800;color:#E7E5E4;">Major Feature Release</h2>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#A8A29E;line-height:1.6;">Describe your headline feature here. What problem does it solve? How does it change the user experience? Make this the centrepiece of your update.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- 3 Feature Highlights -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <h3 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#F59E0B;">Feature Highlights</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="31%" valign="top" style="background:#2D2926;border-radius:10px;border:1px solid rgba(255,255,255,0.06);padding:20px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;">&#9889;</p>
                  <h4 style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:#E7E5E4;">Faster Workflows</h4>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A8A29E;line-height:1.5;">Streamlined interface cuts task time in half with smarter defaults.</p>
                </td>
                <td width="3.5%"></td>
                <td width="31%" valign="top" style="background:#2D2926;border-radius:10px;border:1px solid rgba(255,255,255,0.06);padding:20px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;">&#127919;</p>
                  <h4 style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:#E7E5E4;">Better Accuracy</h4>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A8A29E;line-height:1.5;">Improved AI suggestions deliver higher quality output every time.</p>
                </td>
                <td width="3.5%"></td>
                <td width="31%" valign="top" style="background:#2D2926;border-radius:10px;border:1px solid rgba(255,255,255,0.06);padding:20px;">
                  <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;">&#128274;</p>
                  <h4 style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;color:#E7E5E4;">Enhanced Security</h4>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#A8A29E;line-height:1.5;">New permissions and audit logs keep your workspace safe and compliant.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- Stats / Improvements Section -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <h3 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:700;color:#F59E0B;">By the Numbers</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2D2926;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
              <tr>
                <td width="33%" style="padding:24px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:32px;font-weight:800;color:#F59E0B;">2x</p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#78716C;">Faster</p>
                </td>
                <td width="34%" style="padding:24px;text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:32px;font-weight:800;color:#EF4444;">40%</p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#78716C;">More Accurate</p>
                </td>
                <td width="33%" style="padding:24px;text-align:center;">
                  <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:32px;font-weight:800;color:#D4836A;">500+</p>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#78716C;">Members Using It</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!-- CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:32px 40px 0 40px;text-align:center;">
            <a href="${SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#EF4444);color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;">Try It Now &#8594;</a>
          </td>
        </tr>
      </table>
      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:32px 40px 0 40px;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
      </table>
      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 40px 32px 40px;text-align:center;">
            <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#A8A29E;">Questions or feedback? Just reply to this email.</p>
            <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#78716C;">The Claude Community Team</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="padding:0 8px;"><a href="${SITE_URL}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#D4836A;text-decoration:none;">Website</a></td>
                <td style="color:#78716C;">&#8226;</td>
                <td style="padding:0 8px;"><a href="${SITE_URL}/community" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#D4836A;text-decoration:none;">Community</a></td>
                <td style="color:#78716C;">&#8226;</td>
                <td style="padding:0 8px;"><a href="https://linkedin.com" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#D4836A;text-decoration:none;">LinkedIn</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
      return {
        name: "Product Update",
        description:
          "Polished product announcement with warm gradient header, hero feature, 3-column highlights, stats section, and CTA",
        category: "announcement",
        blocks: JSON.stringify([{ type: "html", props: { code: html } }]),
        html,
      };
    })(),
  ];
}

async function seedStarterTemplates() {
  // Re-seed: delete old starter templates and create fresh ones. Called only
  // from the GET handler (request context), so getPrisma() resolves the acting
  // tenant — each community seeds and owns its OWN starter set.
  const prisma = await getPrisma();
  const SITE_URL = (await getTenantConfig()).siteUrl;
  const STARTER_TEMPLATES = buildStarterTemplates(SITE_URL);
  const existing = await prisma.emailTemplate.findMany({
    where: { isPublic: true },
    select: { id: true, name: true },
  });
  const starterNames = STARTER_TEMPLATES.map((t) => t.name);
  const toDelete = existing.filter((e) => starterNames.includes(e.name));
  if (toDelete.length > 0) {
    await prisma.emailTemplate.deleteMany({ where: { id: { in: toDelete.map((d) => d.id) } } });
  }
  // Only seed if we deleted old ones or none exist
  const remaining = await prisma.emailTemplate.count();
  if (remaining === 0 || toDelete.length > 0) {
    for (const t of STARTER_TEMPLATES) {
      await prisma.emailTemplate.create({ data: { ...t, isPublic: true } });
    }
  }
}

// GET - List templates
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();

    // Seed starter templates on first fetch
    try {
      await seedStarterTemplates();
    } catch {
      /* tables may not exist yet */
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const templates = await prisma.emailTemplate.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        thumbnailUrl: true,
        isPublic: true,
        createdAt: true,
        blocks: true,
        html: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error listing templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create template
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();

    const { name, description, category, blocks, html } = await request.json();

    if (!name?.trim())
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    if (!blocks)
      return NextResponse.json({ error: "Template blocks are required" }, { status: 400 });

    const template = await prisma.emailTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        category: category || "custom",
        blocks: typeof blocks === "string" ? blocks : JSON.stringify(blocks),
        html: html || "",
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
