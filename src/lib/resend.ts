import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import { isSend16Enabled, sendViaSend16 } from "@/lib/send16";
import { getTenantConfig, type TenantConfig } from "@/lib/tenant-config";

// Initialize Resend client lazily to avoid build errors when API key is missing
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Resolve the sender address for the current tenant. `RESEND_FROM_EMAIL` (a
 * deploy-wide override) still wins; otherwise the tenant's configured
 * `fromEmail`. Async because it reads the per-tenant config — callers are
 * already in a request/`runWithTenant` scope (this throws fail-closed if not).
 */
async function resolveFromEmail(): Promise<string> {
  return process.env.RESEND_FROM_EMAIL ?? (await getTenantConfig()).fromEmail;
}

/** The community logo URL for a tenant's emails. */
function logoUrl(config: TenantConfig): string {
  return `${config.siteUrl}/images/claude-code-logo.webp`;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export async function sendEmail({ to, subject, html, replyTo, headers }: SendEmailParams) {
  // Route through Send16 when enabled (EMAIL_PROVIDER=send16). Reversible —
  // unset the flag to fall straight back to the Resend path below.
  if (isSend16Enabled()) {
    return sendViaSend16({ to, subject, html, replyTo, headers });
  }

  // In development without API key, just log
  if (!process.env.RESEND_API_KEY) {
    console.warn("📧 [DEV] Email would be sent:", { to, subject });
    return { success: true, data: { id: "dev-mock-id" } };
  }

  try {
    const client = getResendClient();
    if (!client) {
      console.warn("📧 [DEV] Email would be sent:", { to, subject });
      return { success: true, data: { id: "dev-mock-id" } };
    }
    const data = await client.emails.send({
      from: await resolveFromEmail(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo,
      headers,
    });

    return { success: true, data };
  } catch (error) {
    console.error("📧 Failed to send email:", error);
    return { success: false, error };
  }
}

// Email templates
export function getNotificationEmailHtml(
  userName: string,
  title: string,
  message: string,
  link: string | undefined,
  config: TenantConfig,
): string {
  const baseUrl = config.appUrl;
  const buttonHtml = link
    ? `<a href="${baseUrl}${link}" style="display: inline-block; background: #D4836A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">View Details</a>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #2D2926; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #D4836A 0%, #c4775f 100%); padding: 24px; text-align: center;">
      <img src="${logoUrl(config)}" alt="Claude Community" width="50" height="50" style="max-width: 50px; height: auto; border-radius: 10px; margin-bottom: 12px;" />
      <h1 style="color: white; margin: 0; font-size: 20px;">${config.communityName}</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 8px; color: #A8A29E; font-size: 14px;">Hey ${escapeHtml(userName)},</p>
      <h2 style="margin: 0 0 12px; color: white; font-size: 18px;">${escapeHtml(title)}</h2>
      <p style="margin: 0; color: #E7E5E4; font-size: 15px; line-height: 1.6;">${escapeHtml(message)}</p>
      ${buttonHtml}
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #78716C; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0;">You're receiving this because you have notifications enabled.</p>
      <p style="margin: 8px 0 0;"><a href="${baseUrl}/community/settings/notifications" style="color: #D4836A; text-decoration: none;">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailHtml(userName: string, config: TenantConfig): string {
  const baseUrl = config.appUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${config.communityName}!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #2D2926; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #D4836A 0%, #c4775f 100%); padding: 32px; text-align: center;">
      <img src="${logoUrl(config)}" alt="Claude Community" width="80" height="80" style="max-width: 80px; height: auto; border-radius: 16px; margin-bottom: 16px;" />
      <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to the Community!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #E7E5E4; font-size: 16px; line-height: 1.6;">
        Hey ${escapeHtml(userName)}! 👋
      </p>
      <p style="margin: 0 0 16px; color: #E7E5E4; font-size: 16px; line-height: 1.6;">
        We're excited to have you join <strong>${config.communityName}</strong> - a space for those who love to use Claude Code or for those just getting started.
      </p>
      <p style="margin: 0 0 24px; color: #A8A29E; font-size: 15px; line-height: 1.6;">
        Here's what you can do:
      </p>
      <ul style="margin: 0 0 24px; padding-left: 20px; color: #E7E5E4; font-size: 15px; line-height: 1.8;">
        <li>Stay updated with community news and events</li>
        <li>Share your projects and get feedback</li>
        <li>Join local meetups in your city</li>
        <li>Learn from courses created by the community</li>
        <li>Connect with like-minded members</li>
      </ul>
      <a href="${baseUrl}/community" style="display: inline-block; background: #D4836A; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Explore the Community</a>
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #78716C; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0;">${config.communityName}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getEventReminderEmailHtml(
  userName: string,
  eventTitle: string,
  eventDate: string,
  eventLocation: string,
  eventId: string,
  config: TenantConfig,
): string {
  const baseUrl = config.appUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Reminder: ${eventTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #2D2926; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #D4836A 0%, #c4775f 100%); padding: 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.8); margin: 0 0 4px; font-size: 13px;">UPCOMING EVENT</p>
      <h1 style="color: white; margin: 0; font-size: 20px;">${eventTitle}</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; color: #A8A29E; font-size: 14px;">Hey ${escapeHtml(userName)},</p>
      <p style="margin: 0 0 20px; color: #E7E5E4; font-size: 15px; line-height: 1.6;">
        Just a friendly reminder about an upcoming event you're interested in!
      </p>
      <div style="background: #1C1917; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; color: white; font-weight: 600; font-size: 16px;">📅 ${eventDate}</p>
        <p style="margin: 0; color: #A8A29E; font-size: 14px;">📍 ${eventLocation}</p>
      </div>
      <a href="${baseUrl}/events/${eventId}" style="display: inline-block; background: #D4836A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Event Details</a>
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #78716C; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0;">See you there! 🎉</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function getLumaLinkReadyEmailHtml(
  userName: string,
  eventTitle: string,
  eventDate: string,
  lumaUrl: string,
  eventId: string,
  config: TenantConfig,
): string {
  const baseUrl = config.appUrl;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration is open: ${eventTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #2D2926; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #D4836A 0%, #c4775f 100%); padding: 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.85); margin: 0 0 4px; font-size: 13px; letter-spacing: 1px;">REGISTRATION IS OPEN</p>
      <h1 style="color: white; margin: 0; font-size: 20px;">${eventTitle}</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; color: #A8A29E; font-size: 14px;">Hey ${escapeHtml(userName)},</p>
      <p style="margin: 0 0 20px; color: #E7E5E4; font-size: 15px; line-height: 1.6;">
        Good news — the Luma registration link for <strong>${eventTitle}</strong> is now live. You asked us to let you know when it was ready.
      </p>
      <div style="background: #1C1917; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: white; font-weight: 600; font-size: 16px;">📅 ${eventDate}</p>
      </div>
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${lumaUrl}" style="display: inline-block; background: #D4836A; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">RSVP on Luma</a>
      </div>
      <div style="background: rgba(212,131,106,0.08); border-left: 3px solid #D4836A; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <p style="margin: 0; color: #E7E5E4; font-size: 14px; line-height: 1.6;">
          <strong>One more step:</strong> Registering your interest here didn't reserve your spot. You still need to RSVP on Luma to secure it.
        </p>
      </div>
      <p style="margin: 0; color: #78716C; font-size: 13px;">
        <a href="${baseUrl}/events/${eventId}" style="color: #D4836A; text-decoration: none;">View the event on ${config.communityName}</a>
      </p>
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #78716C; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0;">You're receiving this because you registered interest for this event.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Helper for responsive email images
export function getResponsiveImageHtml(src: string, alt: string = "", width?: number): string {
  const widthAttr = width ? `width="${width}"` : "";
  return `<img src="${src}" alt="${alt}" ${widthAttr} style="max-width: 100%; width: auto; height: auto; display: block;" />`;
}

// Email wrapper for campaigns — compatible with Outlook, Gmail, Apple Mail, Yahoo
// Implementation lives in @/lib/email/wrap so client previews can import it
// without pulling in the Resend SDK.
import { wrapEmailContent } from "@/lib/email/wrap";

export { wrapEmailContent };

// Campaign email template
export function getCampaignEmailHtml(
  userName: string,
  subject: string,
  content: string,
  config: TenantConfig,
  ctaText?: string,
  ctaLink?: string,
  headerImageUrl?: string,
): string {
  const baseUrl = config.appUrl;

  const headerImage = headerImageUrl
    ? `<img src="${headerImageUrl}" alt="" style="max-width: 100%; width: 100%; height: auto; display: block;" />`
    : "";

  const ctaButton =
    ctaText && ctaLink
      ? `<a href="${ctaLink.startsWith("http") ? ctaLink : baseUrl + ctaLink}" style="display: inline-block; background: #D4836A; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">${ctaText}</a>`
      : "";

  const innerContent = `
    <div style="background: #2D2926; border-radius: 16px; overflow: hidden;">
      ${headerImage}
      <div style="padding: 24px;">
        <p style="margin: 0 0 16px; color: #A8A29E; font-size: 14px;">Hey ${escapeHtml(userName)},</p>
        <div style="color: #E7E5E4; font-size: 15px; line-height: 1.6;">
          ${content}
        </div>
        ${ctaButton}
      </div>
    </div>
  `;

  return wrapEmailContent(innerContent, { appUrl: config.appUrl, previewText: subject });
}

type CampaignRecipient = { email: string; name: string; userId: string };
type CampaignResult = {
  sent: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
};

// Send16 variant of the campaign loop — mirrors the Resend loop in
// sendCampaignEmails (per-recipient send + 100ms throttle) so behaviour and
// progress reporting are identical. Reversible via the EMAIL_PROVIDER flag.
async function sendCampaignViaSend16(
  recipients: CampaignRecipient[],
  subject: string,
  htmlGenerator: (name: string) => string,
  onProgress?: (sent: number, failed: number, total: number) => void,
): Promise<CampaignResult> {
  const results: CampaignResult = { sent: 0, failed: 0, errors: [] };

  for (const recipient of recipients) {
    try {
      const html = htmlGenerator(recipient.name || "there");
      const r = await sendViaSend16({ to: recipient.email, subject, html });
      if (r.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({
          userId: recipient.userId,
          error: r.error instanceof Error ? r.error.message : String(r.error),
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: recipient.userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    if (onProgress) {
      onProgress(results.sent, results.failed, recipients.length);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

// Batch send function for campaigns
export async function sendCampaignEmails(
  recipients: CampaignRecipient[],
  subject: string,
  htmlGenerator: (name: string) => string,
  onProgress?: (sent: number, failed: number, total: number) => void,
): Promise<CampaignResult> {
  const results: CampaignResult = { sent: 0, failed: 0, errors: [] };

  // Route through Send16 when enabled. Reversible via the EMAIL_PROVIDER flag.
  if (isSend16Enabled()) {
    return sendCampaignViaSend16(recipients, subject, htmlGenerator, onProgress);
  }

  // In development without API key, simulate
  if (!process.env.RESEND_API_KEY) {
    console.warn(`📧 [DEV] Would send campaign to ${recipients.length} recipients`);
    return { sent: recipients.length, failed: 0, errors: [] };
  }

  const client = getResendClient();
  if (!client) {
    console.warn(`📧 [DEV] Would send campaign to ${recipients.length} recipients`);
    return { sent: recipients.length, failed: 0, errors: [] };
  }

  const from = await resolveFromEmail();
  for (const recipient of recipients) {
    try {
      const html = htmlGenerator(recipient.name || "there");
      await client.emails.send({
        from,
        to: [recipient.email],
        subject,
        html,
      });
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: recipient.userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (onProgress) {
      onProgress(results.sent, results.failed, recipients.length);
    }

    // Rate limiting - Resend has limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

// Invite email template for admin-added users
export function getInviteEmailHtml(
  userName: string,
  config: TenantConfig,
  personalMessage?: string,
): string {
  const baseUrl = config.appUrl;

  const messageSection = personalMessage
    ? `<div style="background: #1C1917; border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 3px solid #D4836A;">
        <p style="margin: 0; color: #E7E5E4; font-size: 15px; line-height: 1.6; font-style: italic;">"${escapeHtml(personalMessage)}"</p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to ${config.communityName}!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1917; color: #E7E5E4; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #2D2926; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #D4836A 0%, #c4775f 100%); padding: 32px; text-align: center;">
      <img src="${logoUrl(config)}" alt="Claude Community" width="80" height="80" style="max-width: 80px; height: auto; border-radius: 16px; margin-bottom: 16px;" />
      <p style="color: rgba(255,255,255,0.9); margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">You're Invited!</p>
      <h1 style="color: white; margin: 0; font-size: 24px;">${config.communityName}</h1>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #E7E5E4; font-size: 16px; line-height: 1.6;">
        Hey ${escapeHtml(userName)}! 👋
      </p>
      <p style="margin: 0 0 16px; color: #E7E5E4; font-size: 16px; line-height: 1.6;">
        You've been invited to join <strong>${config.communityName}</strong> - the community for Claude Code enthusiasts, developers, and AI explorers.
      </p>
      ${messageSection}
      <p style="margin: 0 0 24px; color: #A8A29E; font-size: 15px; line-height: 1.6;">
        As a member, you'll get access to:
      </p>
      <ul style="margin: 0 0 24px; padding-left: 20px; color: #E7E5E4; font-size: 15px; line-height: 1.8;">
        <li>Community discussions and project sharing</li>
        <li>Local meetups in Sydney, Melbourne, Brisbane & more</li>
        <li>Exclusive workshops and learning resources</li>
        <li>Direct connections with fellow Claude Code users</li>
      </ul>
      <div style="text-align: center;">
        <a href="${baseUrl}/login" style="display: inline-block; background: #D4836A; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Join the Community</a>
      </div>
      <p style="margin: 24px 0 0; color: #78716C; font-size: 13px; text-align: center;">
        Just click the button above and sign in with Google to get started.
      </p>
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #78716C; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0;">${config.communityName}</p>
      <p style="margin: 8px 0 0;">Questions? Reply to this email or visit <a href="${baseUrl}" style="color: #D4836A; text-decoration: none;">${baseUrl.replace(/^https?:\/\//, "")}</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export default getResendClient;
