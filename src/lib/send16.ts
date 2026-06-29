/**
 * Send16 transactional adapter.
 *
 * Mirrors the Resend transport in `@/lib/resend` so the app can route its
 * outbound email through Send16 (the "Claude Community" workspace, sending
 * from claudecommunity.com.au) instead of Resend.
 *
 * This is gated behind `EMAIL_PROVIDER=send16` AND a configured
 * `SEND16_API_KEY` — Resend remains the default and the fallback, so flipping
 * the env var is an instant, reversible cutover. The HTML templates in
 * resend.ts are provider-agnostic and unchanged; only the transport differs.
 *
 * Go-live prerequisites (not done here):
 *   1. Verify claudecommunity.com.au in the Send16 workspace (DNS records).
 *   2. Set SEND16_API_KEY (sk_live_ key for the workspace).
 *   3. Set EMAIL_PROVIDER=send16.
 */
import { getTenantConfig } from "@/lib/tenant-config";

const SEND16_BASE_URL = process.env.SEND16_BASE_URL ?? "https://api.send16.com";

// Same sender resolution as resend.ts `resolveFromEmail`: explicit override →
// per-tenant default. Async + per-call so a single shared deploy sends each
// tenant's mail from its own configured sender (never a hardcoded home region).
async function resolveFromEmail(): Promise<string> {
  return process.env.RESEND_FROM_EMAIL ?? (await getTenantConfig()).fromEmail;
}

interface Send16SendParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/** True when the app should route email through Send16 rather than Resend. */
export function isSend16Enabled(): boolean {
  return process.env.EMAIL_PROVIDER === "send16" && !!process.env.SEND16_API_KEY;
}

/**
 * Send a single transactional email via Send16's API.
 * Shape-compatible with resend.ts `sendEmail`, returning the same
 * `{ success, data } | { success, error }` envelope.
 */
export async function sendViaSend16({ to, subject, html, replyTo, headers }: Send16SendParams) {
  const apiKey = process.env.SEND16_API_KEY;

  // No key configured → behave like the dev mock in resend.ts.
  if (!apiKey) {
    console.warn("📧 [DEV] Send16 email would be sent:", { to, subject });
    return { success: true as const, data: { id: "dev-mock-id" } };
  }

  const from = await resolveFromEmail();

  try {
    const res = await fetch(`${SEND16_BASE_URL}/api/transactional/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // Per-source usage rollup convention (X-Send16-Source).
        "X-Send16-Source": "community-app",
      },
      body: JSON.stringify({
        to: Array.isArray(to) ? to : [to],
        from,
        subject,
        html,
        reply_to: replyTo,
        headers,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { message_id?: string; log_id?: string };
      error?: { message?: string };
    };

    if (!res.ok || body.success === false) {
      const message = body.error?.message ?? `HTTP ${res.status}`;
      console.error("📧 Send16 send failed:", message);
      return { success: false as const, error: message };
    }

    return { success: true as const, data: body.data };
  } catch (error) {
    console.error("📧 Send16 send threw:", error);
    return { success: false as const, error };
  }
}
