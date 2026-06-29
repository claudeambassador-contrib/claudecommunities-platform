// Shared email wrapper used by both the send pipeline and the in-app previews
// so what you see in the builder/modal is exactly what recipients receive.
// Kept free of server-only dependencies (no Resend SDK) so it can be imported
// from client components.

// Strip outer-document structural tags so `content` is always safe to embed as
// a body fragment. Removes <!DOCTYPE>, <html>, <head>, <body> opening/closing
// tags only — the *contents* of <head> (e.g. <style> blocks defining layout)
// are preserved and end up inline in the fragment, so imported templates'
// styles still apply after wrapping. Handles legacy campaigns where doctype/
// html/body tags were embedded inside a <td> cell.
export function normalizeFragment(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\/?html(\s[^>]*)?>/gi, "")
    .replace(/<head\b[^>]*>/gi, "")
    .replace(/<\/head>/gi, "")
    .replace(/<\/?body(\s[^>]*)?>/gi, "");
}

/**
 * Wrap an email body fragment in the full responsive shell. Pure: the caller
 * supplies `appUrl` (the tenant's app URL) — resolved from `useTenantConfig()`
 * on the client or `(await getTenantConfig()).appUrl` on the server — so this
 * stays sync and client-importable.
 */
export function wrapEmailContent(
  content: string,
  opts: { appUrl: string; previewText?: string },
): string {
  const { appUrl: baseUrl, previewText } = opts;
  const normalized = normalizeFragment(content);
  const previewHtml = previewText
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${previewText}${"&zwnj;&nbsp;".repeat(30)}</div>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>Claude Community</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td, th { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    a { text-decoration: none; }
  </style>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #1C1917; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #E7E5E4; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  ${previewHtml}
  <!-- Outer wrapper table for full-width background -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1C1917;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td><![endif]-->
        <table class="email-container" role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td>
              ${normalized}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 0 0; font-size: 12px; color: #78716C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <p style="margin: 0;">Claude Code Community</p>
              <p style="margin: 8px 0 0;"><a href="${baseUrl}/community/settings/notifications" style="color: #D4836A; text-decoration: none;">Unsubscribe</a> &bull; <a href="${baseUrl}" style="color: #D4836A; text-decoration: none;">Visit Community</a></p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
