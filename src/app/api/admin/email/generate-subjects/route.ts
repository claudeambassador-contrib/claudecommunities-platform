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
    const { html, name } = await req.json();

    // Extract text content from HTML for context
    const textContent = (html || "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    const config = await getTenantConfig();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You generate email subject lines. Return ONLY a JSON array of 5 subject line strings. No markdown, no explanation. Make them compelling, concise (under 60 chars), and varied in style (some urgent, some curious, some direct, some personal). For a community called ${config.communityName}.`,
      messages: [
        {
          role: "user",
          content: `Generate 5 email subject lines for this email:\n\nCampaign: ${name || "Untitled"}\nContent preview: ${textContent.slice(0, 500)}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ subjects: [] });
    }

    let text = content.text.trim();
    if (text.startsWith("```"))
      text = text
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();

    const subjects = JSON.parse(text);
    return NextResponse.json({ subjects: Array.isArray(subjects) ? subjects.slice(0, 5) : [] });
  } catch (error) {
    console.error("Subject generation failed:", error);
    return NextResponse.json({ subjects: [] });
  }
}
