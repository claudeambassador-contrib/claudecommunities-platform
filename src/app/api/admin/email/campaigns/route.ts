import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// GET - List all campaigns
export async function GET() {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const prisma = await getPrisma();
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { sends: true },
      },
    },
  });

  return NextResponse.json(campaigns);
}

// POST - Create new campaign
export async function POST(request: NextRequest) {
  const auth = await requirePermissionResponse("email.edit");
  if (!auth.ok) return auth.response;

  const { name, subject, html, blocks, templateType, segmentQuery, scheduledAt } =
    await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (!html?.trim()) {
    return NextResponse.json({ error: "Email content is required" }, { status: 400 });
  }

  const prisma = await getPrisma();
  const campaign = await prisma.emailCampaign.create({
    data: {
      name: name.trim(),
      subject: subject.trim(),
      html,
      blocks: blocks || null,
      templateType: templateType || "custom",
      segmentQuery: segmentQuery ? JSON.stringify(segmentQuery) : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: "draft",
    },
  });

  return NextResponse.json(campaign);
}
