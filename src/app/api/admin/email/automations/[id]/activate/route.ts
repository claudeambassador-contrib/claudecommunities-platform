import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// POST - Toggle automation status (activate or pause)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { action } = await request.json();
    const prisma = await getPrisma();

    if (action !== "activate" && action !== "pause") {
      return NextResponse.json({ error: 'Action must be "activate" or "pause"' }, { status: 400 });
    }

    const automation = await prisma.emailAutomation.findUnique({
      where: { id },
      include: {
        _count: {
          select: { steps: true },
        },
      },
    });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    if (action === "activate") {
      // Validate automation has at least 1 step
      if (automation._count.steps === 0) {
        return NextResponse.json(
          { error: "Automation must have at least 1 step before activating" },
          { status: 400 },
        );
      }

      const updated = await prisma.emailAutomation.update({
        where: { id },
        data: { status: "active" },
      });

      return NextResponse.json(updated);
    }

    // action === 'pause'
    const updated = await prisma.emailAutomation.update({
      where: { id },
      data: { status: "paused" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Activate/pause automation error:", error);
    return NextResponse.json({ error: "Failed to update automation status" }, { status: 500 });
  }
}
