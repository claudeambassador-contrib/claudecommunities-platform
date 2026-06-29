import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getCurrentUser } from "@/lib/auth";
import { getTenantConfig } from "@/lib/tenant-config";

// Lazy initialization to avoid build errors when API key is missing
let resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
const BUG_REPORT_EMAIL = "spruik.au@gmail.com";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const steps = formData.get("steps") as string;
    const expected = formData.get("expected") as string;
    const actual = formData.get("actual") as string;
    const screenshot = formData.get("screenshot") as File | null;

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    // Prepare attachments if screenshot provided
    const attachments: { filename: string; content: Buffer }[] = [];
    if (screenshot && screenshot.size > 0) {
      const buffer = Buffer.from(await screenshot.arrayBuffer());
      attachments.push({
        filename: screenshot.name || "screenshot.png",
        content: buffer,
      });
    }

    // Build email HTML
    const config = await getTenantConfig();
    const { lang, defaultTimezone } = config;
    const submittedAt = new Date().toLocaleString(lang, { timeZone: defaultTimezone });
    const submittedTzAbbr =
      new Intl.DateTimeFormat(lang, { timeZone: defaultTimezone, timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || "";
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1C1917; color: #FAF9F6; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2D2926; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px;">🐛</span>
            <h1 style="color: #D4836A; font-size: 24px; margin: 16px 0 8px;">Bug Report</h1>
            <p style="color: #A8A29E; font-size: 14px; margin: 0;">From Claude Community Platform</p>
          </div>

          <div style="background-color: #1C1917; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #D4836A; font-size: 18px; margin: 0 0 8px;">${title}</h2>
            <p style="color: #A8A29E; font-size: 12px; margin: 0;">
              Reported by: ${user.name || "Unknown"} (${user.email || "No email"})
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #FAF9F6; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Description</h3>
            <p style="color: #A8A29E; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${description}</p>
          </div>

          ${
            steps
              ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FAF9F6; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Steps to Reproduce</h3>
            <p style="color: #A8A29E; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${steps}</p>
          </div>
          `
              : ""
          }

          ${
            expected
              ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FAF9F6; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Expected Behavior</h3>
            <p style="color: #A8A29E; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${expected}</p>
          </div>
          `
              : ""
          }

          ${
            actual
              ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FAF9F6; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Actual Behavior</h3>
            <p style="color: #A8A29E; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${actual}</p>
          </div>
          `
              : ""
          }

          ${
            screenshot
              ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #FAF9F6; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Screenshot Attached</h3>
            <p style="color: #A8A29E; font-size: 14px; margin: 0;">📎 ${screenshot.name || "screenshot.png"}</p>
          </div>
          `
              : ""
          }

          <div style="background-color: rgba(212, 131, 106, 0.1); border-radius: 12px; padding: 16px; margin-top: 24px; border-left: 4px solid #D4836A;">
            <p style="color: #A8A29E; font-size: 12px; margin: 0;">
              <strong style="color: #FAF9F6;">User ID:</strong> ${user.id}<br>
              <strong style="color: #FAF9F6;">Submitted:</strong> ${submittedAt} ${submittedTzAbbr}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend
    const client = getResend();
    if (!client) {
      console.warn("📧 [DEV] Bug report would be sent:", { title, to: BUG_REPORT_EMAIL });
      return NextResponse.json({ success: true });
    }
    await client.emails.send({
      from: config.fromEmail,
      to: BUG_REPORT_EMAIL,
      replyTo: user.email || undefined,
      subject: `🐛 Bug Report: ${title}`,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bug report submission error:", error);
    return NextResponse.json({ error: "Failed to submit bug report" }, { status: 500 });
  }
}
