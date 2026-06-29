import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// GET - Get single automation with steps and enrollment count
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const prisma = await getPrisma();

    const automation = await prisma.emailAutomation.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json(automation);
  } catch (error) {
    console.error("Get automation error:", error);
    return NextResponse.json({ error: "Failed to fetch automation" }, { status: 500 });
  }
}

// PUT - Update automation
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { name, description, triggerType, triggerData, status, steps } = await request.json();
    const prisma = await getPrisma();

    const existing = await prisma.emailAutomation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    // If steps are provided, replace all existing steps in a transaction
    if (steps && Array.isArray(steps)) {
      await prisma.$transaction([
        prisma.automationStep.deleteMany({ where: { automationId: id } }),
        ...steps.map((step: { stepType: string; config: unknown; stepOrder: number }) =>
          prisma.automationStep.create({
            data: {
              automationId: id,
              stepType: step.stepType,
              config: typeof step.config === "string" ? step.config : JSON.stringify(step.config),
              stepOrder: step.stepOrder,
            },
          }),
        ),
      ]);
    }

    const automation = await prisma.emailAutomation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(triggerType !== undefined && { triggerType }),
        ...(triggerData !== undefined && {
          triggerData: triggerData ? JSON.stringify(triggerData) : null,
        }),
        ...(status !== undefined && { status }),
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    return NextResponse.json(automation);
  } catch (error) {
    console.error("Update automation error:", error);
    return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
  }
}

// DELETE - Delete automation (cascade deletes steps and enrollments)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermissionResponse("email.delete");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const prisma = await getPrisma();

    const existing = await prisma.emailAutomation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    await prisma.emailAutomation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete automation error:", error);
    return NextResponse.json({ error: "Failed to delete automation" }, { status: 500 });
  }
}
