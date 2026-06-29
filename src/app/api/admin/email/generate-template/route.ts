import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantConfig } from "@/lib/tenant-config";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  const auth = await requirePermissionResponse("email.edit");
  if (!auth.ok) return auth.response;

  try {
    const config = await getTenantConfig();
    const SITE_URL = config.siteUrl;

    const SYSTEM_PROMPT = `You are an expert email template designer for ${config.communityName} — a tech community for Claude Code enthusiasts. You produce HTML that renders perfectly in ALL email clients including Outlook (which uses Microsoft Word's rendering engine), Gmail, Apple Mail, and Yahoo Mail.

Brand guidelines:
- Primary color: #D4836A (warm terracotta/salmon)
- Secondary color: #c4775f (darker shade)
- Dark background: #1C1917
- Card background: #2D2926
- Text primary: #E7E5E4
- Text secondary: #A8A29E
- Text muted: #78716C
- Logo URL: ${SITE_URL}/images/claude-code-logo.webp
- Community URL: ${SITE_URL}
- Font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

Email compatibility rules (CRITICAL):
1. Generate ONLY the inner HTML content (no <!DOCTYPE>, <html>, <head>, or <body> tags — the system wraps it)
2. Use TABLE-BASED LAYOUT for ALL structure — never rely on divs for layout
3. Every table must have: role="presentation" cellpadding="0" cellspacing="0" border="0"
4. Use inline CSS only. Always include font-family on every text element
5. Use bgcolor attribute AND background-color style together on table cells
6. For buttons, use the bulletproof button pattern: a VML roundrect in <!--[if mso]> conditional for Outlook, and a styled <a> in <!--[if !mso]><!--> for other clients
7. For gradient backgrounds, use a solid background-color fallback (Outlook ignores CSS gradients)
8. Do NOT use: CSS shorthand (use margin-top/margin-bottom not margin), rgba() colors (use hex), max-width on divs (use width on tables), float, flexbox, grid, position, or CSS variables
9. For spacers, use a table row with explicit height AND mso-line-height-rule:exactly
10. Images must have: width attribute (number, not %), border="0", display:block, alt text
11. Use &bull; not • for bullet separators
12. Max width is 600px (the outer wrapper handles centering)
13. Support placeholders: {{name}} for recipient name, {{email}} for email, {{subject}} for subject line
14. Always include a greeting like "Hey {{name}},"
15. Include a CTA button using the brand primary color
16. Keep the dark theme. Use hex colors only (e.g. #E7E5E4 not rgba)
17. Do NOT include unsubscribe links or footers — the wrapper adds those

Return ONLY the raw HTML. No markdown, no code fences, no explanation.`;

    const { prompt, templateType, subject } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const userMessage = `Design a beautiful email template for the following:

Type: ${templateType || "general"}
Subject: ${subject || "Not specified"}
Description: ${prompt}

Generate visually impressive, production-ready HTML email content.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    // Strip any markdown code fences if present
    let html = content.text.trim();
    if (html.startsWith("```html")) {
      html = html.slice(7);
    } else if (html.startsWith("```")) {
      html = html.slice(3);
    }
    if (html.endsWith("```")) {
      html = html.slice(0, -3);
    }
    html = html.trim();

    return NextResponse.json({ html, model: response.model });
  } catch (error) {
    console.error("Template generation failed:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
