import { type NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requirePermissionResponse } from "@/lib/route-auth";

// GET - List all contact lists
export async function GET() {
  try {
    const auth = await requirePermissionResponse("email.view");
    if (!auth.ok) return auth.response;

    const prisma = await getPrisma();
    const lists = await prisma.contactList.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Error listing contact lists:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a contact list
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermissionResponse("email.edit");
    if (!auth.ok) return auth.response;

    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "List name is required" }, { status: 400 });
    }

    const prisma = await getPrisma();
    const list = await prisma.contactList.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Error creating contact list:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
