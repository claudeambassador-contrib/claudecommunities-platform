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

    const SYSTEM_PROMPT = `You are an expert email designer for ${config.communityName} — a tech community for Claude Code enthusiasts.

You design emails by composing an ordered array of email building blocks. Return ONLY valid JSON — no markdown, no code fences, no explanation.

Available block types and their properties:

1. "header" — Email header/hero section
   - title: string (the heading text)
   - subtitle: string (optional subheading, use "" if none)
   - showLogo: boolean (true to show community logo)
   - bgGradient: string (CSS gradient, e.g. "linear-gradient(135deg, #D4836A 0%, #c4775f 100%)")

2. "text" — Paragraph/body text
   - content: string (the text, use \\n for line breaks. Use {{name}} for recipient name)
   - fontSize: number (14-18, default 15)
   - color: string (hex color, default "#E7E5E4")
   - align: "left" | "center" | "right"

3. "button" — Call-to-action button
   - text: string (button label)
   - url: string (link URL, use ${SITE_URL} as base)
   - bgColor: string (hex, default "#D4836A")
   - textColor: string (hex, default "#ffffff")
   - align: "left" | "center" | "right"
   - borderRadius: number (default 8)
   - fullWidth: boolean (default false)

4. "divider" — Horizontal line separator
   - color: string (default "rgba(255,255,255,0.06)")
   - width: string (default "100%")
   - thickness: number (default 1)
   - style: "solid" | "dashed" | "dotted"

5. "spacer" — Vertical spacing
   - height: number (pixels, 8-80, default 24)

6. "columns" — Two-column layout
   - leftContent: string (left column text, use \\n for line breaks)
   - rightContent: string (right column text, use \\n for line breaks)
   - ratio: "50-50" | "30-70" | "70-30"

7. "image" — Image placeholder (user uploads actual images later)
   - src: string (always "" — user uploads separately)
   - alt: string (describe what image should go here)
   - width: string (default "100%")
   - align: "center"
   - borderRadius: number (default 12)

8. "social" — Social links section
   - align: "center"
   - links: Array<{ platform: string, url: string }>

Brand design system:
- Primary: #D4836A (warm terracotta)
- Secondary: #c4775f
- Background: #1C1917
- Card: #2D2926
- Text: #E7E5E4
- Text secondary: #A8A29E
- Website: ${SITE_URL}

Guidelines:
- Always start with a header block
- Always include a greeting text block with "Hey {{name}},"
- Use spacer blocks (16-32px) between content sections for breathing room
- Include at least one button CTA
- End with a friendly sign-off text
- Keep content concise and engaging
- For multi-section emails, use dividers or spacers to separate
- Use columns for side-by-side content like speaker bios, pricing, or features

Return ONLY a JSON array: [{ "type": "...", "props": { ... } }, ...]`;

    const { prompt, templateType, subject } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const userMessage = `Design an email with these blocks:

Type: ${templateType || "general"}
Subject: ${subject || "Community Update"}
Description: ${prompt}

Return the JSON array of blocks.`;

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

    let text = content.text.trim();
    if (text.startsWith("```json")) text = text.slice(7);
    else if (text.startsWith("```")) text = text.slice(3);
    if (text.endsWith("```")) text = text.slice(0, -3);
    text = text.trim();

    const blocks = JSON.parse(text);

    if (!Array.isArray(blocks)) {
      throw new Error("Expected array of blocks");
    }

    // Validate block types
    const validTypes = [
      "header",
      "text",
      "image",
      "button",
      "divider",
      "spacer",
      "columns",
      "social",
      "html",
    ];
    const validated = blocks.filter(
      (b: { type: string }) => b && typeof b === "object" && validTypes.includes(b.type),
    );

    return NextResponse.json({ blocks: validated, model: response.model });
  } catch (error) {
    console.error("Block generation failed:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
