import { type NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { getPlatformPrisma, getPrisma } from "@/lib/prisma";
import { runWithTenant } from "@/lib/tenant-context";

function htmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function errorPage() {
  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invalid Link - Claude Community</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#1C1917; color:#E7E5E4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .card { text-align:center; max-width:420px; padding:2rem; }
    h1 { font-size:1.25rem; margin-bottom:0.5rem; }
    p { color:#A8A29E; font-size:0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Invalid or Expired Link</h1>
    <p>This unsubscribe link is no longer valid. If you need to manage your email preferences, please visit your account settings.</p>
  </div>
</body>
</html>`,
    400,
  );
}

// ---------------------------------------------------------------------------
// GET — show the unsubscribe confirmation form
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = verifyUnsubscribeToken(token);

  if (!result) {
    return errorPage();
  }

  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribe - Claude Community</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#1C1917; color:#E7E5E4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding:1rem; }
    .card { text-align:center; max-width:460px; width:100%; }
    .logo { margin-bottom:1.5rem; }
    .logo svg { width:48px; height:48px; }
    h1 { font-size:1.25rem; margin-bottom:0.75rem; line-height:1.4; }
    p { color:#A8A29E; font-size:0.9rem; margin-bottom:1.5rem; line-height:1.5; }
    button { display:inline-block; padding:0.75rem 2rem; background:#D4836A; color:#1C1917; border:none; border-radius:8px; font-size:1rem; font-weight:600; cursor:pointer; transition:background 0.15s; }
    button:hover { background:#C0715A; }
    button:active { transform:scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="12" fill="#D4836A"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="22" font-weight="700" fill="#1C1917" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">CC</text>
      </svg>
    </div>
    <h1>Unsubscribe from Claude Community emails?</h1>
    <p>You will stop receiving weekly digests and event reminder emails. You can re-subscribe anytime from your account settings.</p>
    <form method="POST">
      <input type="hidden" name="token" value="${token}" />
      <button type="submit">Confirm Unsubscribe</button>
    </form>
  </div>
</body>
</html>`,
  );
}

// ---------------------------------------------------------------------------
// POST — process the unsubscribe
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: paramToken } = await params;

  // Read token from form body (fallback to URL param)
  let token = paramToken;
  try {
    const formData = await request.formData();
    const bodyToken = formData.get("token");
    if (typeof bodyToken === "string" && bodyToken) {
      token = bodyToken;
    }
  } catch {
    // If form parsing fails, use the URL param
  }

  const result = verifyUnsubscribeToken(token);
  if (!result) {
    return errorPage();
  }

  const { userId, sendId } = result;

  try {
    const platform = await getPlatformPrisma();

    // Email preferences are global-per-user (EmailPreference.userId @unique), so
    // an unsubscribe applies across every community the user belongs to.
    await platform.emailPreference.upsert({
      where: { userId },
      update: {
        weeklyDigest: false,
        eventReminders: false,
      },
      create: {
        userId,
        weeklyDigest: false,
        eventReminders: false,
      },
    });

    // The token carries no tenant. Resolve it from the send (global lookup by
    // unique id), then write the SCOPED tracking event under that send's tenant
    // so tenantId is injected (not the "" default).
    const send = await platform.emailSend.findFirst({
      where: { id: sendId },
      select: { campaignId: true, tenantId: true },
    });

    if (send) {
      await runWithTenant(send.tenantId, async () => {
        const prisma = await getPrisma();
        await prisma.emailTrackingEvent.create({
          data: {
            campaignId: send.campaignId,
            sendId,
            eventType: "unsubscribe",
          },
        });
      });
    }
  } catch {
    // Even if DB operations fail, show the confirmation page
  }

  return htmlResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribed - Claude Community</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#1C1917; color:#E7E5E4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding:1rem; }
    .card { text-align:center; max-width:460px; width:100%; }
    .check { margin-bottom:1rem; }
    .check svg { width:48px; height:48px; }
    h1 { font-size:1.25rem; margin-bottom:0.75rem; color:#D4836A; }
    p { color:#A8A29E; font-size:0.9rem; line-height:1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="24" fill="#D4836A" opacity="0.15"/>
        <path d="M15 24.5L21 30.5L33 18.5" stroke="#D4836A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive weekly digests or event reminder emails from Claude Community. You can re-subscribe anytime from your account settings.</p>
  </div>
</body>
</html>`,
  );
}
