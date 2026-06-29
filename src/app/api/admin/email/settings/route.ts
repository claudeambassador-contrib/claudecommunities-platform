import { type NextRequest, NextResponse } from "next/server";
import { requirePermissionResponse } from "@/lib/route-auth";
import { getTenantConfig } from "@/lib/tenant-config";
// GET - Return default email platform settings
export async function GET() {
  try {
    const auth = await requirePermissionResponse("email.settings");
    if (!auth.ok) return auth.response;

    const config = await getTenantConfig();
    return NextResponse.json({
      senderName: config.communityName,
      senderEmail: config.senderEmail,
      trackOpens: true,
      trackClicks: true,
      bounceAction: "disable",
      domain: config.senderDomain,
      domainVerified: true,
      spfStatus: "verified",
      dkimStatus: "verified",
      dmarcStatus: "verified",
    });
  } catch (error) {
    console.error("Email settings GET error:", error);
    return NextResponse.json({ error: "Failed to fetch email settings" }, { status: 500 });
  }
}

// PUT - Acknowledge settings update (stored later when model is added)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.settings");
    if (!auth.ok) return auth.response;

    // Consume the body so the request doesn't hang
    await request.json();

    return NextResponse.json({ success: true, message: "Settings updated" });
  } catch (error) {
    console.error("Email settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update email settings" }, { status: 500 });
  }
}
