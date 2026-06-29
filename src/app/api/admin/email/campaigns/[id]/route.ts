import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// GET - Get single campaign
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("email.view");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const prisma = await getPrisma();

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      sends: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      _count: {
        select: { sends: true },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(campaign);
}

// PUT - Update campaign
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermissionResponse("email.edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { name, subject, html, blocks, templateType, segmentQuery, scheduledAt, status } =
    await request.json();

  const prisma = await getPrisma();

  const existing = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Don't allow editing sent campaigns
  if (existing.status === "sent" || existing.status === "sending") {
    return NextResponse.json({ error: "Cannot edit a sent campaign" }, { status: 400 });
  }

  const campaign = await prisma.emailCampaign.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(subject && { subject: subject.trim() }),
      ...(html && { html }),
      ...(blocks !== undefined && { blocks: blocks || null }),
      ...(templateType && { templateType }),
      ...(segmentQuery !== undefined && {
        segmentQuery: segmentQuery ? JSON.stringify(segmentQuery) : null,
      }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
      ...(status && { status }),
    },
  });

  return NextResponse.json(campaign);
}

// DELETE - Delete campaign
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermissionResponse("email.delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const prisma = await getPrisma();

  const existing = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Don't delete campaigns that are currently sending
  if (existing.status === "sending") {
    return NextResponse.json(
      { error: "Cannot delete a campaign that is currently sending" },
      { status: 400 },
    );
  }

  await prisma.emailCampaign.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
