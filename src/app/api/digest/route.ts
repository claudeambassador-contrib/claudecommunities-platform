import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generateDigestForUser, generateDigestHtml, sendDigestEmails } from "@/lib/digest";

// POST /api/digest - Trigger digest email sending (admin only or cron)
export async function POST(request: Request) {
  try {
    // Check for cron secret or admin session
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      // Valid cron request
      const result = await sendDigestEmails();
      return NextResponse.json(result);
    }

    // Otherwise require admin session
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = user.role;
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const result = await sendDigestEmails();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to send digests:", error);
    return NextResponse.json({ error: "Failed to send digests" }, { status: 500 });
  }
}

// GET /api/digest?preview=true - Preview digest for current user
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";

    const digestData = await generateDigestForUser(userId);

    if (!digestData) {
      return NextResponse.json({ error: "No digest data available" }, { status: 404 });
    }

    if (preview) {
      const html = generateDigestHtml(digestData, user?.name || "there");
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return NextResponse.json(digestData);
  } catch (error) {
    console.error("Failed to generate digest preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
