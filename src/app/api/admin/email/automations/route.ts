import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

const VALID_TRIGGER_TYPES = [
  "signup",
  "tag_added",
  "event_rsvp",
  "manual",
  "date_based",
  "inactivity",
];

// GET - List all automations
export async function GET() {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();

    const raw = await prisma.emailAutomation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    const automations = raw.map((a) => ({
      ...a,
      enrolledCount: a._count.enrollments,
    }));

    return NextResponse.json(automations);
  } catch (error) {
    console.error("List automations error:", error);
    return NextResponse.json({ error: "Failed to fetch automations" }, { status: 500 });
  }
}

// POST - Create a new automation
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();

    const { name, description, triggerType, triggerData } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!triggerType?.trim()) {
      return NextResponse.json({ error: "Trigger type is required" }, { status: 400 });
    }
    if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
      return NextResponse.json(
        { error: `Invalid trigger type. Must be one of: ${VALID_TRIGGER_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const automation = await prisma.emailAutomation.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        triggerType,
        triggerData: triggerData ? JSON.stringify(triggerData) : null,
      },
    });

    return NextResponse.json(automation);
  } catch (error) {
    console.error("Create automation error:", error);
    return NextResponse.json({ error: "Failed to create automation" }, { status: 500 });
  }
}
